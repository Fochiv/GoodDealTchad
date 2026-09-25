import { Router } from "express";
import { db } from "@workspace/db";
import { commandesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { InitierPaiementBody, ConfirmerOtpBody } from "@workspace/api-zod";
import { FORFAITS } from "./forfaits";
import { randomUUID } from "crypto";

const router = Router();

const ASHTECH_API_KEY = process.env.ASHTECH_API_KEY;
const ASHTECH_BASE_URL = (process.env.ASHTECH_BASE_URL || "https://www.ashtechpay.com").replace(/\/+$/, "");

type AshtechCountry = {
  code: string;
  currency: string;
  operators: string[];
};

let countriesCache: { expiresAt: number; countries: AshtechCountry[] } | null = null;

async function getAshtechCountries(): Promise<AshtechCountry[]> {
  if (countriesCache && countriesCache.expiresAt > Date.now()) {
    return countriesCache.countries;
  }

  const response = await fetch(`${ASHTECH_BASE_URL}/v1/countries`, {
    headers: { Authorization: `Bearer ${ASHTECH_API_KEY}` },
  });

  if (!response.ok) {
    throw new Error(`AshtechPay countries request failed with status ${response.status}`);
  }

  const payload = await response.json() as unknown;
  if (!Array.isArray(payload)) {
    throw new Error("AshtechPay countries response is invalid");
  }

  const countries = payload.filter((country): country is AshtechCountry => {
    if (!country || typeof country !== "object") return false;
    const candidate = country as Record<string, unknown>;
    return (
      typeof candidate.code === "string" &&
      typeof candidate.currency === "string" &&
      Array.isArray(candidate.operators) &&
      candidate.operators.every((operator) => typeof operator === "string")
    );
  });

  countriesCache = { countries, expiresAt: Date.now() + 5 * 60 * 1000 };
  return countries;
}

async function resolveTchadPaymentOperator(paymentOperator: string) {
  const countries = await getAshtechCountries();
  const tchad = countries.find((country) => country.code === "TD");

  if (!tchad) {
    throw new Error("AshtechPay does not currently list Chad as an active country");
  }

  const operator = tchad.operators.find((candidate) => candidate === paymentOperator);
  if (!operator) {
    throw new Error(`AshtechPay does not currently list operator "${paymentOperator}" for Chad`);
  }

  return { currency: tchad.currency, operator };
}

// Initier un paiement Mobile Money
router.post("/paiement/initier", async (req, res) => {
  const parsed = InitierPaiementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ erreur: "bad_request", message: "Données invalides", reference: null, ussdCode: null });
    return;
  }

  const { forfaitId, beneficiairePhone, paymentOperator, paymentPhone } = parsed.data;

  // Find the forfait
  const forfait = FORFAITS.find((f) => f.id === forfaitId);
  if (!forfait) {
    res.status(400).json({ erreur: "bad_request", message: "Forfait introuvable", reference: null, ussdCode: null });
    return;
  }

  let paymentConfig: Awaited<ReturnType<typeof resolveTchadPaymentOperator>>;
  try {
    paymentConfig = await resolveTchadPaymentOperator(paymentOperator);
  } catch (err) {
    req.log.error({ err }, "AshtechPay country/operator catalogue error");
    res.status(503).json({
      erreur: "provider_unavailable",
      message: "Le service de paiement ne propose pas cet opérateur pour le Tchad.",
      reference: null,
      ussdCode: null,
    });
    return;
  }

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const randomChars = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const randomNums = String(Math.floor(Math.random() * 90000) + 10000);
  const reference = `ASHPAY-PAY-${randomChars}-${randomNums}`;

  // Create commande in DB (MySQL: no .returning(), use insertId then SELECT)
  const insertResult = await db
    .insert(commandesTable)
    .values({
      forfaitId,
      operateurForfait: forfait.operateur,
      beneficiairePhone,
      paymentOperator,
      paymentPhone,
      reference,
      statut: "pending",
      montant: forfait.prix,
    });

  const insertId = insertResult[0].insertId as number;
  const commandeRows = await db
    .select()
    .from(commandesTable)
    .where(eq(commandesTable.id, insertId));
  const commande = commandeRows[0];

  try {
    // Call AshtechPay API
    const ashtechResponse = await fetch(`${ASHTECH_BASE_URL}/v1/collect`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ASHTECH_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: forfait.prix,
        currency: paymentConfig.currency,
        phone: paymentPhone.startsWith("+") ? paymentPhone : `+235${paymentPhone}`,
        operator: paymentConfig.operator,
        country_code: "TD",
        reference,
      }),
    });

    const ashtechData = await ashtechResponse.json() as Record<string, unknown>;

    if (
      ashtechData.sandbox === true &&
      ashtechData.simulation === true &&
      typeof ashtechData.status === "string"
    ) {
      const simulatedStatus = ashtechData.status.toLowerCase();
      if (!["success", "pending", "failed", "cancelled"].includes(simulatedStatus)) {
        throw new Error("AshtechPay returned an unsupported sandbox status");
      }

      await db
        .update(commandesTable)
        .set({ transactionId: null, statut: `simulation_${simulatedStatus}` })
        .where(eq(commandesTable.id, commande.id));

      res.status(202).json({
        transactionId: null,
        reference,
        statut: simulatedStatus,
        montant: ashtechData.amount ?? forfait.prix,
        montantNet: ashtechData.credited_amount ?? null,
        operateur: paymentConfig.operator,
        telephone: paymentPhone.startsWith("+") ? paymentPhone : `+235${paymentPhone}`,
        simulation: true,
      });
      return;
    }

    if (ashtechResponse.status === 202) {
      // Success — USSD push sent
      await db
        .update(commandesTable)
        .set({ transactionId: ashtechData.transaction_id as string, statut: "pending" })
        .where(eq(commandesTable.id, commande.id));

      res.status(202).json({
        transactionId: ashtechData.transaction_id,
        reference: ashtechData.reference,
        statut: "pending",
        montant: forfait.prix,
        montantNet: ashtechData.credited_amount,
        operateur: paymentOperator,
        telephone: paymentPhone,
      });
    } else if (ashtechResponse.status === 400 && ashtechData.error === "otp_required") {
      // OTP required
      const otpReference =
        typeof ashtechData.reference === "string" && ashtechData.reference
          ? ashtechData.reference
          : reference;
      await db
        .update(commandesTable)
        .set({ reference: otpReference, statut: "otp_required" })
        .where(eq(commandesTable.id, commande.id));

      res.status(400).json({
        erreur: "otp_required",
        message: ashtechData.message,
        reference: otpReference,
        ussdCode: ashtechData.ussd_code || null,
      });
    } else {
      // Other error
      await db
        .update(commandesTable)
        .set({ statut: "failed" })
        .where(eq(commandesTable.id, commande.id));

      res.status(400).json({
        erreur: (ashtechData.error as string) || "erreur",
        message: (ashtechData.message as string) || "Une erreur est survenue",
        reference: null,
        ussdCode: null,
      });
    }
  } catch (err) {
    req.log.error({ err }, "AshtechPay error");
    await db
      .update(commandesTable)
      .set({ statut: "failed" })
      .where(eq(commandesTable.id, commande.id));

    res.status(500).json({
      erreur: "server_error",
      message: "Erreur de connexion au service de paiement",
      reference: null,
      ussdCode: null,
    });
  }
});

// Confirmer avec OTP
router.post("/paiement/otp", async (req, res) => {
  const parsed = ConfirmerOtpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ erreur: "bad_request", message: "Données invalides", reference: null, ussdCode: null });
    return;
  }

  const { reference, otp, paymentOperator, paymentPhone, montant } = parsed.data;

  try {
    const paymentConfig = await resolveTchadPaymentOperator(paymentOperator);
    const ashtechResponse = await fetch(`${ASHTECH_BASE_URL}/v1/collect`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ASHTECH_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: montant,
        currency: paymentConfig.currency,
        phone: paymentPhone.startsWith("+") ? paymentPhone : `+235${paymentPhone}`,
        operator: paymentConfig.operator,
        country_code: "TD",
        reference,
        otp,
      }),
    });

    const ashtechData = await ashtechResponse.json() as Record<string, unknown>;

    if (
      ashtechData.sandbox === true &&
      ashtechData.simulation === true &&
      typeof ashtechData.status === "string"
    ) {
      const simulatedStatus = ashtechData.status.toLowerCase();
      if (!["success", "pending", "failed", "cancelled"].includes(simulatedStatus)) {
        throw new Error("AshtechPay returned an unsupported sandbox status");
      }

      await db
        .update(commandesTable)
        .set({ transactionId: null, statut: `simulation_${simulatedStatus}` })
        .where(eq(commandesTable.reference, reference));

      res.status(202).json({
        transactionId: null,
        reference,
        statut: simulatedStatus,
        montant: ashtechData.amount ?? montant,
        montantNet: ashtechData.credited_amount ?? null,
        operateur: paymentConfig.operator,
        telephone: paymentPhone.startsWith("+") ? paymentPhone : `+235${paymentPhone}`,
        simulation: true,
      });
      return;
    }

    if (ashtechResponse.status === 202) {
      // Update commande status
      await db
        .update(commandesTable)
        .set({ transactionId: ashtechData.transaction_id as string, statut: "pending" })
        .where(eq(commandesTable.reference, reference));

      res.status(202).json({
        transactionId: ashtechData.transaction_id,
        reference: ashtechData.reference,
        statut: "pending",
        montant: ashtechData.amount,
        montantNet: ashtechData.credited_amount,
        operateur: paymentOperator,
        telephone: paymentPhone,
      });
    } else {
      res.status(400).json({
        erreur: (ashtechData.error as string) || "erreur",
        message: (ashtechData.message as string) || "Code OTP invalide",
        reference: null,
        ussdCode: null,
      });
    }
  } catch (err) {
    req.log.error({ err }, "AshtechPay OTP error");
    res.status(500).json({
      erreur: "server_error",
      message: "Erreur de connexion au service de paiement",
      reference: null,
      ussdCode: null,
    });
  }
});

// Statut d'une transaction
router.get("/paiement/statut/:transactionId", async (req, res) => {
  const { transactionId } = req.params;

  try {
    const ashtechResponse = await fetch(`${ASHTECH_BASE_URL}/v1/transaction/${transactionId}`, {
      headers: {
        Authorization: `Bearer ${ASHTECH_API_KEY}`,
      },
    });

    if (ashtechResponse.status === 404) {
      res.status(404).json({ error: "Transaction introuvable" });
      return;
    }

    const ashtechData = await ashtechResponse.json() as Record<string, unknown>;

    // Update local commande status
    if (ashtechData.status === "success" || ashtechData.status === "failed") {
      await db
        .update(commandesTable)
        .set({ statut: ashtechData.status as string })
        .where(eq(commandesTable.transactionId, transactionId));
    }

    res.json({
      transactionId: ashtechData.transaction_id,
      reference: ashtechData.reference || null,
      statut: ashtechData.status,
      montant: ashtechData.amount || null,
      montantNet: ashtechData.credited_amount || null,
      telephone: ashtechData.phone || null,
      confirmedAt: ashtechData.confirmed_at || null,
    });
  } catch (err) {
    req.log.error({ err }, "AshtechPay statut error");
    res.status(500).json({ error: "Erreur de connexion" });
  }
});

// Liste des commandes récentes
router.get("/commandes", async (req, res) => {
  const commandes = await db
    .select()
    .from(commandesTable)
    .orderBy(commandesTable.createdAt)
    .limit(50);

  res.json(
    commandes.map((c) => ({
      id: c.id,
      forfaitId: c.forfaitId,
      operateurForfait: c.operateurForfait,
      beneficiairePhone: c.beneficiairePhone,
      paymentOperator: c.paymentOperator,
      paymentPhone: c.paymentPhone,
      transactionId: c.transactionId,
      reference: c.reference,
      statut: c.statut,
      montant: c.montant,
      createdAt: c.createdAt.toISOString(),
    }))
  );
});

export default router;
