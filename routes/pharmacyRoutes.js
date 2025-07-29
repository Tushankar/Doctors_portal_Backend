import { Router } from "express";
import {
  // registerPharmacy,
  getPharmacyByUserId,
  searchPharmacies,
  updatePharmacy,
  getNearbyPharmacies,
  getPharmacyDetails,
  getPharmacyInventory,
  getPatientHealthRecords,
  approveHealthRecordAccess,
  getPendingHealthRecordRequests,
  getPatientMedicationHistory,
  getSharedHealthRecords,
} from "../controllers/pharmacyController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize as checkRole } from "../middleware/roleMiddleware.js";

const router = Router();

// Authenticate all pharmacy routes
router.use(protect);

// Prescription handling for pharmacies
import {
  listIncomingPrescriptions,
  respondToPrescription,
  viewPrescription,
  updateFulfillmentStatus,
  getPrescriptionHistory,
} from "../controllers/pharmacyController.js";

// Register a new pharmacy (Pharmacy Role)
// router.post("/register", checkRole(["pharmacy"]), async (req, res, next) => {
//   try {
//     const result = await registerPharmacy(
//       req.user.id,
//       { ...req.body, userId: req.user.id },
//       req.files || []
//     );
//     res.status(201).json(result);
//   } catch (error) {
//     next(error);
//   }
// });

// Search pharmacies (public)
router.get("/search", async (req, res, next) => {
  try {
    const result = await searchPharmacies(
      {
        longitude: req.query.longitude
          ? parseFloat(req.query.longitude)
          : undefined,
        latitude: req.query.latitude
          ? parseFloat(req.query.latitude)
          : undefined,
        radius: req.query.radius ? parseFloat(req.query.radius) : undefined,
        city: req.query.city,
        state: req.query.state,
        services: req.query.services,
        rating: req.query.rating ? parseFloat(req.query.rating) : undefined,
        isOpen: req.query.isOpen === "true",
      },
      {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        sort: req.query.sort || "rating",
        order: req.query.order || "desc",
      }
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get nearby pharmacies (patient view)
// Get nearby pharmacies (patient view)
router.get("/nearby", async (req, res) => {
  try {
    const { lat, lng, radius, page, limit } = req.query;
    const result = await getNearbyPharmacies(
      {
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        radius: parseInt(radius) || 10000,
      },
      { page: parseInt(page) || 1, limit: parseInt(limit) || 20 }
    );
    res.json(result);
  } catch (error) {
    console.error("Error in /pharmacies/nearby:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch nearby pharmacies",
    });
  }
});

// Get pharmacy by user ID
router.get("/user/:userId", async (req, res, next) => {
  try {
    const result = await getPharmacyByUserId(req.params.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Update pharmacy (owner)
router.put("/:id", checkRole(["pharmacy"]), async (req, res, next) => {
  try {
    const result = await updatePharmacy(
      req.params.id,
      { ...req.body, userId: req.user.id },
      req.user.id
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// End of pharmacy routes

// List incoming prescriptions
router.get("/prescriptions/incoming", async (req, res, next) => {
  try {
    const result = await listIncomingPrescriptions(req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Respond to a prescription (accept/decline)
router.post(
  "/prescriptions/:prescriptionId/respond",
  checkRole(["pharmacy"]),
  async (req, res, next) => {
    try {
      const { action, pharmacyId } = req.body;

      // If pharmacyId is not provided in body, try to get it from user's pharmacy data
      let finalPharmacyId = pharmacyId;
      if (!finalPharmacyId) {
        // Get pharmacy by user ID
        const pharmacy = await getPharmacyByUserId(req.user.id);
        if (pharmacy.success && pharmacy.data) {
          finalPharmacyId = pharmacy.data._id;
        } else {
          return res.status(400).json({
            success: false,
            message: "Pharmacy ID required or pharmacy not found for user",
          });
        }
      }

      const result = await respondToPrescription(
        req.params.prescriptionId,
        finalPharmacyId,
        action
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// View a prescription
router.get("/prescriptions/:prescriptionId", async (req, res, next) => {
  try {
    const result = await viewPrescription(req.params.prescriptionId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Update fulfillment status
router.patch(
  "/prescriptions/:prescriptionId/fulfillment-status",
  checkRole(["pharmacy"]),
  async (req, res, next) => {
    try {
      const { status } = req.body;
      const result = await updateFulfillmentStatus(
        req.params.prescriptionId,
        status
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Prescription history for pharmacy
router.get("/prescriptions/history", async (req, res, next) => {
  try {
    const result = await getPrescriptionHistory(req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Fetch full pharmacy details (patient view)
router.get("/:id/details", async (req, res) => {
  try {
    const result = await getPharmacyDetails(req.params.id);
    res.json(result);
  } catch (error) {
    console.error("Error in /pharmacies/:id/details:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
      stack: error.stack,
    });
  }
});

// Fetch pharmacy inventory
router.get("/:id/inventory", async (req, res) => {
  try {
    const result = await getPharmacyInventory(req.params.id);
    res.json(result);
  } catch (error) {
    console.error("Error in /pharmacies/:id/inventory:", error);
    res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
});

// Health Records Management Routes for Pharmacies
router.get(
  "/patients/:patientId/health-records",
  checkRole(["pharmacy"]),
  async (req, res, next) => {
    try {
      await getPatientHealthRecords(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/patients/:patientId/medication-history",
  checkRole(["pharmacy"]),
  async (req, res, next) => {
    try {
      await getPatientMedicationHistory(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/health-records/pending",
  checkRole(["pharmacy"]),
  async (req, res, next) => {
    try {
      await getPendingHealthRecordRequests(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  "/patients/:patientId/health-records/:recordId/approve",
  checkRole(["pharmacy"]),
  async (req, res, next) => {
    try {
      await approveHealthRecordAccess(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

// Get shared health records for a specific patient
router.get(
  "/patients/:patientId/shared-health-records",
  checkRole(["pharmacy"]),
  async (req, res, next) => {
    try {
      await getSharedHealthRecords(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
