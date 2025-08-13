import express from "express";
import {
  sendContactEmail,
  getContactInfo,
} from "../controllers/contactController.js";

const router = express.Router();

// POST /api/contact/send - Send contact form email
router.post("/send", sendContactEmail);

// GET /api/contact/info - Get contact information
router.get("/info", getContactInfo);

export default router;
