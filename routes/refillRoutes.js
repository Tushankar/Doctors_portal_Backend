import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorize as checkRole } from "../middleware/roleMiddleware.js";
import {
  createRefillRequest,
  getPharmacyRefillRequests,
  getPharmacyRefillRequestCount,
  respondToRefillRequest,
  getPatientRefillRequests,
} from "../controllers/refillController.js";

const router = Router();

// All routes require authentication
router.use(protect);

/**
 * @route   POST /api/v1/refills/request
 * @desc    Create a new refill request
 * @access  Private (Patient only)
 */
router.post("/request", checkRole(["patient"]), createRefillRequest);

/**
 * @route   GET /api/v1/refills/patient
 * @desc    Get patient's refill requests
 * @access  Private (Patient only)
 */
router.get("/patient", checkRole(["patient"]), getPatientRefillRequests);

/**
 * @route   GET /api/v1/refills/pharmacy
 * @desc    Get pharmacy's refill requests
 * @access  Private (Pharmacy only)
 */
router.get("/pharmacy", checkRole(["pharmacy"]), getPharmacyRefillRequests);

/**
 * @route   GET /api/v1/refills/pharmacy/count
 * @desc    Get count of pending refill requests for pharmacy
 * @access  Private (Pharmacy only)
 */
router.get(
  "/pharmacy/count",
  checkRole(["pharmacy"]),
  getPharmacyRefillRequestCount
);

/**
 * @route   POST /api/v1/refills/:refillId/respond
 * @desc    Respond to a refill request (approve/reject)
 * @access  Private (Pharmacy only)
 */
router.post(
  "/:refillId/respond",
  checkRole(["pharmacy"]),
  respondToRefillRequest
);

export default router;
