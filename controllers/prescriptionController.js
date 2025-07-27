import mongoose from "mongoose";
import { Prescription } from "../models/Prescription.js";
import { ocrService } from "./ocrService.js";
import { matchDrugs } from "../utils/mlMatcher.js";
import { fileUploadService } from "./fileUploadController.js";
import Pharmacy from "../models/Pharmacy.js";
import Patient from "../models/Patient.js";

class PrescriptionController {
  constructor() {
    // Bind methods
    this.createPrescription = this.createPrescription.bind(this);
    this.processPrescription = this.processPrescription.bind(this);
    this.getPrescriptionById = this.getPrescriptionById.bind(this);
    this.getPrescriptions = this.getPrescriptions.bind(this);
    this.updatePrescriptionStatus = this.updatePrescriptionStatus.bind(this);
    this.reprocessPrescription = this.reprocessPrescription.bind(this);
    this.deletePrescription = this.deletePrescription.bind(this);
    this.getApprovalRequests = this.getApprovalRequests.bind(this);
    this.respondApproval = this.respondApproval.bind(this);
    this.selectPharmacy = this.selectPharmacy.bind(this);
    this.createApprovalRequests = this.createApprovalRequests.bind(this);
    this.getIncomingRequests = this.getIncomingRequests.bind(this);
  }

  /**
   * Create and process a new prescription
   */
  async createPrescription(data) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Validate file data
      if (!data.originalFile || !data.originalFile.secureUrl) {
        const error = new Error("Invalid prescription file data");
        error.statusCode = 400;
        throw error;
      }

      // Create prescription with initial state
      const prescription = new Prescription({
        patientId: data.patientId,
        originalFile: data.originalFile,
        description: data.description || "",
        patientNotes: data.patientNotes || "",
        status: "uploaded",
        ocrData: {
          // initialize with minimal required fields; defaults in schema may not apply during transactions
          extractedText: data.initialText || "",
          processingStatus: "pending",
          medications: [],
          confidence: 0,
        },
      });
      // Explicitly ensure extractedText is present
      if (!prescription.ocrData.extractedText) {
        prescription.ocrData.extractedText = "";
      }

      // Attempt to save, retry if extractedText validation fails
      try {
        await prescription.save({ session });
      } catch (e) {
        if (e.message.includes("ocrData.extractedText")) {
          prescription.ocrData.extractedText = "";
          await prescription.save({ session });
        } else {
          throw e;
        }
      }
      await session.commitTransaction();

      // Process prescription immediately
      this.processPrescription(prescription._id).catch(console.error);

      // Initialize empty approvalRequests array
      // find patient location for geospatial query
      const patient = await Patient.findById(data.patientId).lean();
      const coords = patient.address.location.coordinates; // [lng, lat]
      // find pharmacies within 50km (50000 meters)
      let nearby = [];
      if (coords && coords.length === 2) {
        nearby = await Pharmacy.find(
          {
            location: {
              $near: {
                $geometry: { type: "Point", coordinates: coords },
                $maxDistance: 50000,
              },
            },
          },
          "_id"
        );
      }
      prescription.approvalRequests = nearby.map((ph) => ({
        pharmacyId: ph._id,
      }));
      await prescription.save();

      return {
        success: true,
        message: "Prescription created and processing started",
        data: prescription,
      };
    } catch (error) {
      await session.abortTransaction();
      const err = new Error(error.message || "Failed to create prescription");
      err.statusCode = error.statusCode || 500;
      throw err;
    } finally {
      session.endSession();
    }
  }

  // Get approval requests for patient
  async getApprovalRequests(prescriptionId, patientId) {
    const prescription = await Prescription.findOne({
      _id: prescriptionId,
      patientId,
    })
      .populate("approvalRequests.pharmacyId", "pharmacyName contactInfo")
      .lean();
    if (!prescription)
      throw new Error("Prescription not found or unauthorized");
    return {
      success: true,
      data: { approvals: prescription.approvalRequests },
    };
  }

  // Pharmacy respond to approval request
  async respondApproval(prescriptionId, pharmacyId, status) {
    const prescription = await Prescription.findById(prescriptionId);
    if (!prescription) throw new Error("Prescription not found");
    const req = prescription.approvalRequests.find(
      (a) => a.pharmacyId.toString() === pharmacyId.toString()
    );
    if (!req) throw new Error("Approval request not found");
    req.status = status;
    req.respondedAt = new Date();
    await prescription.save();
    return { success: true, message: `Request ${status}` };
  }

  // Pharmacy fetch incoming prescription requests pending their approval
  async getIncomingRequests(pharmacyId) {
    // Find prescriptions where this pharmacy has a pending approval request
    const prescriptions = await Prescription.find({
      "approvalRequests.pharmacyId": pharmacyId,
      "approvalRequests.status": "pending",
    })
      .populate("patientId", "profile.name")
      .lean();
    // Map to request info
    const requests = prescriptions.map((p) => {
      const req = p.approvalRequests.find(
        (a) =>
          a.pharmacyId.toString() === pharmacyId.toString() &&
          a.status === "pending"
      );
      return {
        prescriptionId: p._id,
        patient: { profile: { name: p.patientId.profile.name } },
        requestedAt: req.requestedAt,
      };
    });
    return { success: true, data: { requests } };
  }

  // Patient select pharmacy for fulfillment
  async selectPharmacy(prescriptionId, patientId, pharmacyId) {
    const prescription = await Prescription.findOne({
      _id: prescriptionId,
      patientId,
    });
    if (!prescription)
      throw new Error("Prescription not found or unauthorized");
    // ensure pharmacy approved
    const approved = prescription.approvalRequests.find(
      (a) =>
        a.pharmacyId.toString() === pharmacyId.toString() &&
        a.status === "approved"
    );
    if (!approved) throw new Error("Pharmacy not approved");
    prescription.pharmacyId = pharmacyId;
    prescription.status = "accepted";
    await prescription.save();
    return { success: true, message: "Pharmacy selected" };
  }

  /**
   * Process prescription with OCR and validation
   */
  async processPrescription(prescriptionId) {
    const startTime = Date.now();
    console.log(`processPrescription started for ${prescriptionId}`);

    try {
      const prescription = await Prescription.findById(prescriptionId);
      if (!prescription) {
        const error = new Error("Prescription not found");
        error.statusCode = 404;
        throw error;
      }

      // Update status to processing
      prescription.status = "processing";
      await prescription.save();

      // Perform OCR
      const ocrResult = await ocrService.processPrescriptionImage(
        prescription.originalFile.secureUrl,
        { enhanced: true }
      );
      // Match extracted medications against drug database
      if (ocrResult && Array.isArray(ocrResult.medications)) {
        ocrResult.medications = await matchDrugs(ocrResult.medications);
      }

      prescription.ocrData = ocrResult;
      console.log(
        `processPrescription OCR result for ${prescriptionId}:`,
        ocrResult
      );

      // Set validation results based on OCR output
      if (
        ocrResult.processingStatus === "completed" &&
        ocrResult.medications.length > 0
      ) {
        prescription.validationResults = {
          isValid: true,
          flags: [],
          aiConfidence: ocrResult.confidence || 0,
          reviewRequired: false,
          validatedAt: new Date(),
        };
        prescription.status = "processed";
      } else {
        prescription.status = "processing_failed";
        prescription.validationResults = {
          isValid: false,
          flags: [
            {
              type: "processing_error",
              severity: "high",
              message: "Failed to extract medications from prescription",
              confidence: 1,
            },
          ],
          aiConfidence: 0,
          reviewRequired: true,
          validatedAt: new Date(),
        };
      }

      await prescription.save();
      console.log(
        `processPrescription completed for ${prescriptionId}; ocrData:`,
        prescription.ocrData
      );

      const processingTime = Date.now() - startTime;
      return {
        prescriptionId,
        success: true,
        ocrResult,
        validationResult: prescription.validationResults,
        processingTime,
      };
    } catch (error) {
      try {
        await Prescription.findByIdAndUpdate(prescriptionId, {
          status: "processing_failed",
          "ocrData.processingStatus": "failed",
          "ocrData.processingError": error.message,
        });
      } catch (updateError) {
        console.error(
          "Failed to update prescription error status:",
          updateError
        );
      }

      const err = new Error(error.message || "Failed to process prescription");
      err.statusCode = error.statusCode || 500;
      throw err;
    }
  }

  /**
   * Get prescription by ID with caching
   */
  async getPrescriptionById(id, options = {}) {
    try {
      console.log(`getPrescriptionById called for ${id}`);
      const prescription = await Prescription.findById(id)
        .populate("patientId", "profile.name email")
        .populate("pharmacyId", "pharmacyName contactInfo")
        .lean();
      console.log(`getPrescriptionById response for ${id}:`, prescription);

      if (!prescription) {
        const error = new Error("Prescription not found");
        error.statusCode = 404;
        throw error;
      }

      // Add computed fields
      prescription.isExpired = this.checkIfExpired(prescription);
      prescription.timeUntilExpiry = this.getTimeUntilExpiry(prescription);

      return {
        success: true,
        message: "Prescription retrieved successfully",
        data: prescription,
      };
    } catch (error) {
      const err = new Error(error.message || "Failed to retrieve prescription");
      err.statusCode = error.statusCode || 500;
      throw err;
    }
  }

  /**
   * Get prescriptions with advanced filtering and aggregation
   */
  async getPrescriptions(query) {
    try {
      const {
        patientId,
        pharmacyId,
        status,
        fromDate,
        toDate,
        hasWarnings,
        requiresReview,
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = query;

      // Build query
      const filter = {};
      if (patientId) filter.patientId = new mongoose.Types.ObjectId(patientId);
      if (pharmacyId)
        filter.pharmacyId = new mongoose.Types.ObjectId(pharmacyId);
      if (status) filter.status = status;
      if (hasWarnings) filter["validationResults.flags.0"] = { $exists: true };
      if (requiresReview) filter["validationResults.reviewRequired"] = true;

      // Date range filter
      if (fromDate || toDate) {
        filter.createdAt = {};
        if (fromDate) filter.createdAt.$gte = new Date(fromDate);
        if (toDate) filter.createdAt.$lte = new Date(toDate);
      }

      // Build aggregation pipeline
      const pipeline = [
        { $match: filter },
        {
          $lookup: {
            from: "users",
            localField: "patientId",
            foreignField: "_id",
            as: "patient",
          },
        },
        {
          $lookup: {
            from: "pharmacies",
            localField: "pharmacyId",
            foreignField: "_id",
            as: "pharmacy",
          },
        },
        {
          $addFields: {
            patient: { $arrayElemAt: ["$patient", 0] },
            pharmacy: { $arrayElemAt: ["$pharmacy", 0] },
            warningCount: {
              $size: { $ifNull: ["$validationResults.flags", []] },
            },
            isExpired: {
              $lt: ["$expiryDate", new Date()],
            },
          },
        },
        {
          $project: {
            _id: 1,
            status: 1,
            originalFile: 1,
            description: 1,
            createdAt: 1,
            warningCount: 1,
            isExpired: 1,
            "patient.profile.name": 1,
            "patient.email": 1,
            "pharmacy.pharmacyName": 1,
            "pharmacy.contactInfo": 1,
            "ocrData.medications": 1,
            "validationResults.reviewRequired": 1,
          },
        },
      ];

      // Add sorting
      const sortField = {};
      sortField[sortBy] = sortOrder === "asc" ? 1 : -1;
      pipeline.push({ $sort: sortField });

      // Add pagination
      const skip = (page - 1) * limit;
      pipeline.push({ $skip: skip }, { $limit: limit });

      // Execute aggregation
      const [prescriptions, totalCount] = await Promise.all([
        Prescription.aggregate(pipeline),
        Prescription.countDocuments(filter),
      ]);

      return {
        success: true,
        message: "Prescriptions retrieved successfully",
        data: {
          prescriptions,
          pagination: {
            page,
            limit,
            total: totalCount,
            pages: Math.ceil(totalCount / limit),
          },
          stats: {
            totalPrescriptions: totalCount,
            withWarnings: prescriptions.filter((p) => p.warningCount > 0)
              .length,
            expired: prescriptions.filter((p) => p.isExpired).length,
            requiresReview: prescriptions.filter(
              (p) => p.validationResults?.reviewRequired
            ).length,
          },
        },
      };
    } catch (error) {
      Logger.error("Failed to get prescriptions:", error);
      throw new ApiError("Failed to retrieve prescriptions", 500);
    }
  }

  /**
   * Update prescription status with validation and notifications
   */
  async updatePrescriptionStatus(id, status, pharmacyId = null) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const prescription = await Prescription.findById(id).session(session);

      if (!prescription) {
        const error = new Error("Prescription not found");
        error.statusCode = 404;
        throw error;
      }

      // Validate status transition
      this.validateStatusTransition(prescription.status, status);

      // Update prescription
      const updateData = { status };
      if (pharmacyId) {
        updateData.pharmacyId = pharmacyId;
        updateData["fulfillmentDetails.pharmacyId"] = pharmacyId;
        updateData["fulfillmentDetails.status"] = "pending";
      }

      Object.assign(prescription, updateData);
      await prescription.save({ session });

      // Commit transaction
      await session.commitTransaction();

      return {
        success: true,
        message: "Prescription status updated successfully",
        data: prescription,
      };
    } catch (error) {
      await session.abortTransaction();
      const err = new Error(
        error.message || "Failed to update prescription status"
      );
      err.statusCode = error.statusCode || 500;
      throw err;
    } finally {
      session.endSession();
    }
  }

  /**
   * Reprocess a prescription
   */
  async reprocessPrescription(id) {
    try {
      const prescription = await Prescription.findById(id);
      if (!prescription) {
        const error = new Error("Prescription not found");
        error.statusCode = 404;
        throw error;
      }
      // Trigger processing again
      const result = await this.processPrescription(id);
      return {
        success: true,
        message: "Prescription reprocessed successfully",
        data: result,
      };
    } catch (error) {
      const err = new Error(
        error.message || "Failed to reprocess prescription"
      );
      err.statusCode = error.statusCode || 500;
      throw err;
    }
  }

  /**
   * Delete a prescription
   */
  async deletePrescription(id) {
    try {
      const prescription = await Prescription.findByIdAndDelete(id);
      if (!prescription) {
        const error = new Error("Prescription not found");
        error.statusCode = 404;
        throw error;
      }
      return {
        success: true,
        message: "Prescription deleted successfully",
      };
    } catch (error) {
      const err = new Error(error.message || "Failed to delete prescription");
      err.statusCode = error.statusCode || 500;
      throw err;
    }
  }

  // Helper methods
  determineValidity(medicationValidations, drugInteractions) {
    const hasHighSeverityFlags = medicationValidations.some((validation) =>
      validation.flags.some(
        (flag) => flag.severity === "high" || flag.severity === "critical"
      )
    );

    const hasHighSeverityInteractions = drugInteractions.some(
      (interaction) =>
        interaction.severity === "high" || interaction.severity === "critical"
    );

    return !(hasHighSeverityFlags || hasHighSeverityInteractions);
  }

  flattenValidationFlags(medicationValidations) {
    return medicationValidations.reduce((flags, validation) => {
      return [...flags, ...validation.flags];
    }, []);
  }

  calculateConfidenceScore(medicationValidations) {
    const scores = medicationValidations.map((validation) => {
      const validationScore = 1 - validation.flags.length * 0.1;
      return (validation.medication.confidence + validationScore) / 2;
    });

    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  determineReviewRequired(medicationValidations, drugInteractions) {
    return (
      medicationValidations.some((validation) =>
        validation.flags.some(
          (flag) => flag.severity === "high" || flag.severity === "critical"
        )
      ) ||
      drugInteractions.some(
        (interaction) =>
          interaction.severity === "high" || interaction.severity === "critical"
      )
    );
  }

  validateStatusTransition(currentStatus, newStatus) {
    const validTransitions = {
      uploaded: ["processing", "cancelled"],
      processing: ["processed", "processing_failed"],
      processed: ["accepted", "cancelled"],
      accepted: ["preparing", "cancelled"],
      preparing: ["ready", "cancelled"],
      ready: ["delivered", "cancelled"],
      processing_failed: ["uploaded", "cancelled"],
      cancelled: [],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      const error = new Error(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
      error.statusCode = 400;
      throw error;
    }
  }

  checkIfExpired(prescription) {
    if (!prescription.expiryDate) return false;
    return new Date() > new Date(prescription.expiryDate);
  }

  getTimeUntilExpiry(prescription) {
    if (!prescription.expiryDate) return null;
    const now = new Date();
    const expiry = new Date(prescription.expiryDate);
    return expiry > now ? expiry - now : 0;
  }
}

// Export singleton instance
export const prescriptionController = new PrescriptionController();
