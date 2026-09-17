# Good Deal Tchad

Site de vente de forfaits internet au Tchad pour les opérateurs Airtel et Moov, avec paiement via Mobile Money (Airtel Money / Moov Money) intégré via l'API AshtechPay.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — serveur API (port 8080, `/api`)
- `pnpm --filter @workspace/forfaits-gabon run dev` — frontend React (port dynamique, `/`)
- `pnpm run typecheck` — vérification TypeScript complète
- `pnpm --filter @workspace/api-spec run codegen` — régénérer les hooks API depuis la spec OpenAPI (puis patcher `zod.int()` → `zod.number()`)
- `pnpm --filter @workspace/db run push` — appliquer les migrations DB (dev only)
- Required env: `MYSQL_DATABASE_URL`, `ASHTECH_API_KEY`
- Optional env: `ASHTECH_BASE_URL` (default: `https://www.ashtechpay.com`)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui
- API: Express 5
- DB: MySQL + Drizzle ORM (`mysql2`)
- Validation: Zod (v4), drizzle-zod
- API codegen: Orval (depuis OpenAPI spec)
- Paiement: AshtechPay Direct API v1

## Where things live

- `artifacts/forfaits-gabon/` — frontend React (page principale, modal d'achat)
- `artifacts/api-server/src/routes/forfaits.ts` — liste statique des forfaits
- `artifacts/api-server/src/routes/paiement.ts` — routes paiement → AshtechPay
- `lib/api-spec/openapi.yaml` — contrat API source de vérité
- `lib/db/src/schema/commandes.ts` — table des commandes

## Architecture decisions

- Forfaits définis statiquement côté serveur (pas en DB) — simples à modifier
- AshtechPay appelé côté serveur uniquement (clé API jamais exposée au frontend)
- Flux USSD Push (Airtel/Moov Tchad) — client reçoit notification sur son téléphone
- OTP flow géré si AshtechPay retourne `otp_required`
- Commandes sauvegardées en DB pour traçabilité

## Product

- Page unique avec hero + sections Airtel et Moov
- 4 forfaits : Moov 6Go/1200F, 13Go/2600F — Airtel 5Go/1100F, 15Go/3100F
- Modal d'achat en 5 étapes : sélection → numéro bénéficiaire → mode paiement → numéro paiement → confirmation
- Polling automatique du statut de transaction
- Gestion des erreurs OTP

## User preferences

_À compléter selon les retours utilisateur._

## Gotchas

- Orval v8 génère `zod.int()` pour les champs `number` nullables — incompatible avec zod v3. Après codegen, patcher avec : `sed -i 's/zod\.int()/zod.number()/g' lib/api-zod/src/generated/api.ts` puis relancer `typecheck:libs`
- L'API AshtechPay utilise toujours `https://www.ashtechpay.com` comme base API documentée ; `https://doc.ashtechpay.com` est le domaine de documentation
- Le catalogue AshtechPay confirme pour le Tchad : `country_code: "TD"`, `currency: "XAF"`, opérateurs exacts `"Airtel Money"` et `"Moov Money"`
- Le serveur recharge et valide le catalogue `/v1/countries` avec un cache de 5 minutes avant chaque collecte

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- AshtechPay docs : `attached_assets/AshtechPay_API_Direct_v1_1786998220988.pdf`
