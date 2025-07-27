import { Router } from "express";
import {
  getProfile,
  updateProfile,
  updateMedicalHistory,
  addCurrentMedication,
  removeCurrentMedication,
  getPrescriptionHistory,
  getPharmacyConsultations,
  scheduleConsultation,
  updateConsultationStatus,
  getChatHistory,
  updateChatUnreadCount,
  discoverNearbyPharmacies,
  uploadPrescription,
  makePayment,
  getPaymentHistory,
} from "../controllers/patientController.js";
import { protect } from "../middleware/authMiddleware.js";
import { fileUploadService } from "../controllers/fileUploadController.js";

const router = Router();

// All routes protected
router.use(protect);

// Profile
router.get("/profile", getProfile);
router.put("/profile", updateProfile);

// Medical history
router.patch("/medical-history", updateMedicalHistory);

// Current medications
router.post("/medications", addCurrentMedication);
router.delete("/medications/:medicationId", removeCurrentMedication);

// Prescription upload
router.post(
  "/prescriptions/upload",
  fileUploadService.getUploadMiddleware("PRESCRIPTION").single("file"),
  uploadPrescription
);

// Prescription history
router.get("/prescriptions/history", getPrescriptionHistory);

// Nearby pharmacies
router.get("/pharmacies/nearby", discoverNearbyPharmacies);

// Pharmacy chat & consultations
router.get("/consultations", getPharmacyConsultations);
router.post("/consultations", scheduleConsultation);
router.patch("/consultations/:consultationId", updateConsultationStatus);

// Chat history
router.get("/chats", getChatHistory);
router.patch("/chats/:pharmacyId/unread", updateChatUnreadCount);

// Payments
router.post("/payments", makePayment);
router.get("/payments", getPaymentHistory);

export default router;
