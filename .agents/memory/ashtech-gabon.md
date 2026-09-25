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

## Refus opérateur pour solde insuffisant

Un refus de collecte causé par un solde Mobile Money insuffisant peut apparaître comme HTTP 400 alors que le numéro et la requête sont corrects. Ne déduire pas qu’un champ est invalide à partir du seul statut HTTP; tenir compte du message renvoyé par le fournisseur et de la notification de l’opérateur.

**Why:** Un essai réel au Tchad a été refusé par l’opérateur faute de fonds, malgré l’interprétation initiale du HTTP 400 comme une possible erreur de champ.

**How to apply:** Pour diagnostiquer un HTTP 400, vérifier le `error`/`message` complet fourni par AshTechPay et le SMS/USSD de l’opérateur avant de modifier les champs ou le format des numéros.
