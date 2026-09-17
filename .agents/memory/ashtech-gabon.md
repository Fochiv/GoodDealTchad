---
name: AshtechPay Tchad catalogue
description: Valeurs du catalogue live AshtechPay pour les paiements Mobile Money du site Good Deal Tchad.
---

## Paramètres POST /v1/collect pour le Tchad

```json
{
  "country_code": "TD",
  "currency": "XAF",
  "operator": "Airtel Money",   // ou "Moov Money"
  "phone": "235XXXXXXXX",
  "amount": 1200,
  "reference": "ASHPAY-PAY-XXXXXXXX"
}
```

**Why:** Le catalogue live `/v1/countries` confirme le Tchad avec le code `TD`, la devise `XAF`, et les noms exacts `"Airtel Money"` et `"Moov Money"`. Le serveur ne doit pas supposer ces valeurs sans valider le catalogue.

**How to apply:** Charger le catalogue côté serveur avec un cache court, sélectionner `TD`, puis utiliser la devise et la valeur d'opérateur retournées dans `/api/paiement/initier` et `/api/paiement/otp`.

Flux : consulter le statut après le `202 pending` et gérer le cas `otp_required` selon la réponse AshtechPay.
