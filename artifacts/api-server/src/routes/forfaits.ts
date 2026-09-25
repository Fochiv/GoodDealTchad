import { Router } from "express";

const router = Router();

// Static list of forfaits - can be moved to DB later
const FORFAITS = [
  {
    id: "moov-6go-7j",
    operateur: "moov",
    volume: "6 Go",
    prix: 1200,
    validite: "7 jours",
    validiteJours: 7,
    description: "Forfait internet Moov 6Go valable 7 jours",
  },
  {
    id: "moov-13go-30j",
    operateur: "moov",
    volume: "13 Go",
    prix: 2600,
    validite: "30 jours",
    validiteJours: 30,
    description: "Forfait internet Moov 13Go valable 30 jours",
  },
  {
    id: "moov-go-illimites-30j",
    operateur: "moov",
    volume: "Go illimités",
    prix: 5500,
    validite: "30 jours",
    validiteJours: 30,
    description: "Forfait internet Moov Go illimités valable 30 jours",
  },
  {
    id: "airtel-5go-7j",
    operateur: "airtel",
    volume: "5 Go",
    prix: 1100,
    validite: "7 jours",
    validiteJours: 7,
    description: "Forfait internet Airtel 5Go valable 7 jours",
  },
  {
    id: "airtel-15go-30j",
    operateur: "airtel",
    volume: "15 Go",
    prix: 3100,
    validite: "30 jours",
    validiteJours: 30,
    description: "Forfait internet Airtel 15Go valable 30 jours",
  },
  {
    id: "airtel-go-illimites-30j",
    operateur: "airtel",
    volume: "Go illimités",
    prix: 5500,
    validite: "30 jours",
    validiteJours: 30,
    description: "Forfait internet Airtel Go illimités valable 30 jours",
  },
];

router.get("/forfaits", (req, res) => {
  res.json(FORFAITS);
});

export { FORFAITS };
export default router;
