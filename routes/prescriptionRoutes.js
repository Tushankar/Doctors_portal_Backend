import { Router } from "express";
import { prescriptionController } from "../controllers/prescriptionController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize as checkRole } from "../middleware/roleMiddleware.js";
import { fileUploadService } from "../controllers/fileUploadController.js";
import { UPLOAD_PRESETS } from "../config/cloudinary.js";

const router = Router();

// Apply authentication to all routes
router.use(protect);

/**
 * @route   POST /api/v1/prescriptions/upload-url
 * @desc    Generate signed upload URL for direct client uploads
 * @access  Private
 */
/** Generate signed upload URL for direct client uploads */
router.get("/upload-url", async (req, res, next) => {
  try {
    const signedUrl = await fileUploadService.generateSignedUrl(
      "PRESCRIPTION",
      req.user.id
    );

    if (!signedUrl) {
      throw new Error("Failed to generate upload URL");
    }

    res.json({
      success: true,
      message: "Upload URL generated successfully",
      data: {
        uploadUrl: signedUrl.url,
        uploadParams: signedUrl.params,
        maxFileSize: UPLOAD_PRESETS.PRESCRIPTION.max_file_size,
        allowedFormats: UPLOAD_PRESETS.PRESCRIPTION.allowed_formats,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/v1/prescriptions/upload
 * @desc    Upload prescription file with server-side processing
 * @access  Private
 */
router.post(
  "/upload",
  fileUploadService.getUploadMiddleware("PRESCRIPTION").single("file"),
  async (req, res, next) => {
    try {
      // Patient select a pharmacy for fulfillment
      router.patch(
        "/:id/select",
        checkRole(["patient"]),
        async (req, res, next) => {
          try {
            const { pharmacyId } = req.body;
            const result = await prescriptionController.selectPharmacy(
              req.params.id,
              req.user.id,
              pharmacyId
            );
            res.json(result);
          } catch (err) {
            next(err);
          }
        }
      );
      // Process uploaded file using FileUploadService
      const processedFile = fileUploadService.processUploadedFile(req.file);

      const result = await prescriptionController.createPrescription({
        patientId: req.user.id,
        originalFile: processedFile,
        description: req.body.description,
        patientNotes: req.body.patientNotes,
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/v1/prescriptions
 * @desc    Get user's prescriptions with advanced filtering
 * @access  Private
 */
router.get("/", async (req, res, next) => {
  try {
    // Convert string parameters to proper types
    const query = {
      ...req.query,
      patientId:
        req.user.role === "patient" ? req.user.id : req.query.patientId,
      pharmacyId:
        req.user.role === "pharmacy"
          ? req.user.pharmacyId
          : req.query.pharmacyId,
      hasWarnings: req.query.hasWarnings === "true",
      requiresReview: req.query.requiresReview === "true",
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10,
    };

    const result = await prescriptionController.getPrescriptions(query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/prescriptions/:id
 * @desc    Get specific prescription
 * @access  Private
 */
router.get("/:id", async (req, res, next) => {
  try {
    const result = await prescriptionController.getPrescriptionById(
      req.params.id,
      { bypassCache: req.query.bypassCache === "true" }
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/v1/prescriptions/:id/reprocess
 * @desc    Manually trigger reprocessing
 * @access  Private (Admin only)
 */
router.post("/:id/reprocess", checkRole(["admin"]), async (req, res, next) => {
  try {
    const result = await prescriptionController.reprocessPrescription(
      req.params.id
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PATCH /api/v1/prescriptions/:id/status
 * @desc    Update prescription status
 * @access  Private (Pharmacy or Admin)
 */
router.patch(
  "/:id/status",
  checkRole(["pharmacy", "admin"]),
  async (req, res, next) => {
    try {
      const result = await prescriptionController.updatePrescriptionStatus(
        req.params.id,
        req.body.status,
        req.body.pharmacyId ||
          (req.user.role === "pharmacy" ? req.user.pharmacyId : null)
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);
// Pharmacy respond to prescription request (approve/reject)
router.patch(
  "/:id/approval",
  checkRole(["pharmacy"]),
  async (req, res, next) => {
    try {
      const { status } = req.body;
      const result = await prescriptionController.respondApproval(
        req.params.id,
        req.user.pharmacyId,
        status
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);
// Pharmacy fetch incoming prescription requests
router.get("/requests", checkRole(["pharmacy"]), async (req, res, next) => {
  try {
    const result = await prescriptionController.getIncomingRequests(
      req.user.pharmacyId
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/v1/prescriptions/:id/processing-status
 * @desc    Get processing status
 * @access  Private
 */
router.get("/:id/processing-status", async (req, res, next) => {
  try {
    const prescription = await prescriptionController.getPrescriptionById(
      req.params.id,
      {
        bypassCache: true,
      }
    );

    const status = {
      status: prescription.data.status,
      ocrStatus: prescription.data.ocrData?.processingStatus,
      validationStatus: prescription.data.validationResults
        ? "completed"
        : "pending",
      lastProcessed:
        prescription.data.ocrData?.processedAt || prescription.data.updatedAt,
    };

    res.json({
      success: true,
      message: "Processing status retrieved successfully",
      data: status,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/v1/prescriptions/:id
 * @desc    Delete prescription
 * @access  Private (Admin only)
 */
router.delete("/:id", checkRole(["admin"]), async (req, res, next) => {
  try {
    const result = await prescriptionController.deletePrescription(
      req.params.id
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
