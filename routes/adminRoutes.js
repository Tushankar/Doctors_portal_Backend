// routes/adminRoutes.js
import express from "express";
import {
  getPendingPharmacyApprovals,
  getPharmacyApproval,
  approvePharmacy,
  rejectPharmacy,
  getAllPharmacies,
  getAllPatients,
  getPatientDetails,
  toggleUserStatus,
  getDashboardStats,
  createAdmin,
  getAllAdmins,
  updateAdminPermissions,
  fixPharmacyApprovalStatus,
} from "../controllers/adminController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes require authentication and admin role
router.use(protect);
router.use(authorize("admin"));

// Dashboard
router.get("/dashboard/stats", getDashboardStats);

// Pharmacy approval management
router.get("/pharmacy-approvals", getPendingPharmacyApprovals);
router.get("/pharmacy-approvals/:id", getPharmacyApproval);
router.put("/pharmacy-approvals/:id/approve", approvePharmacy);
router.put("/pharmacy-approvals/:id/reject", rejectPharmacy);

// Fix existing pharmacy approval statuses
router.post("/fix-pharmacy-approval-status", fixPharmacyApprovalStatus);

// User management
router.get("/pharmacies", getAllPharmacies);
router.get("/patients", getAllPatients);
router.get("/patients/:id", getPatientDetails);
router.put("/users/:id/toggle-status", toggleUserStatus);

// Admin management (super admin only)
router.post("/admins", createAdmin);
router.get("/admins", getAllAdmins);
router.put("/admins/:id/permissions", updateAdminPermissions);

export default router;
