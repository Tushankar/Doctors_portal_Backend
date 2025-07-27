import mongoose from "mongoose";
import { Prescription } from "../models/Prescription.js";
import { ocrService } from "./ocrService.js";
import { matchDrugs } from "../utils/mlMatcher.js";
import { fileUploadService } from "./fileUploadController.js";
import Pharmacy from "../models/Pharmacy.js";
import Patient from "../models/Patient.js";
import { orderController } from "./orderController.js";

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
    this.getIncomingRequests = this.getIncomingRequests.bind(this);
    this.getPrescriptionWithOrder = this.getPrescriptionWithOrder.bind(this);
  }

  /**
   * Create and process a new prescription
   */
  async createPrescription(data) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      console.log("[CREATE_PRESCRIPTION] Transaction started");

      // Validate file data
      if (!data.originalFile || !data.originalFile.secureUrl) {
        console.error(
          "[CREATE_PRESCRIPTION] Missing or invalid prescription file"
        );
        const error = new Error("Invalid prescription file data");
        error.statusCode = 400;
        throw error;
      }

      console.log("[CREATE_PRESCRIPTION] File data validated");

      // Create prescription with initial state
      const prescription = new Prescription({
        patientId: data.patientId,
        originalFile: data.originalFile,
        description: data.description || "",
        patientNotes: data.patientNotes || "",
        status: "uploaded",
        ocrData: {
          extractedText: data.initialText || "",
          processingStatus: "pending",
          medications: [],
          confidence: 0,
        },
      });

      if (!prescription.ocrData.extractedText) {
        console.warn(
          "[CREATE_PRESCRIPTION] No extractedText, setting to empty string"
        );
        prescription.ocrData.extractedText = "";
      }

      console.log(
        "[CREATE_PRESCRIPTION] Attempting to save prescription:",
        prescription
      );

      try {
        await prescription.save({ session });
        console.log(
          "[CREATE_PRESCRIPTION] Prescription saved successfully in DB (within transaction)"
        );
      } catch (e) {
        console.warn(
          "[CREATE_PRESCRIPTION] Save error, checking extractedText issue:",
          e.message
        );
        if (e.message.includes("ocrData.extractedText")) {
          prescription.ocrData.extractedText = "";
          await prescription.save({ session });
          console.log(
            "[CREATE_PRESCRIPTION] Retried save after setting extractedText"
          );
        } else {
          throw e;
        }
      }

      await session.commitTransaction();
      console.log("[CREATE_PRESCRIPTION] Transaction committed");

      // Process prescription immediately
      this.processPrescription(prescription._id)
        .then(() =>
          console.log("[CREATE_PRESCRIPTION] Prescription processing started")
        )
        .catch((err) =>
          console.error("[CREATE_PRESCRIPTION] Error in processing:", err)
        );

      // Find patient location for geospatial query
      const patient = await Patient.findById(data.patientId).lean();
      console.log(
        "[CREATE_PRESCRIPTION] Fetched patient location:",
        patient?.address?.location
      );

      const coords = patient?.address?.location?.coordinates;

      // Find pharmacies within 50km (50,000 meters)
      let nearby = [];
      if (coords && coords.length === 2 && coords[0] !== 0 && coords[1] !== 0) {
        // Valid coordinates (not default [0,0])
        nearby = await Pharmacy.find(
          {
            location: {
              $near: {
                $geometry: { type: "Point", coordinates: coords },
                $maxDistance: 50000, // 50km
              },
            },
          },
          "_id pharmacyName"
        );
        console.log(
          `[CREATE_PRESCRIPTION] Found ${nearby.length} nearby pharmacies using geolocation`
        );
      } else {
        console.warn(
          "[CREATE_PRESCRIPTION] No valid coordinates for patient, falling back to city/state search"
        );

        // Fallback: search by city/state if coordinates are invalid
        const patientCity = patient?.address?.city;
        const patientState = patient?.address?.state;

        if (patientCity || patientState) {
          const cityStateQuery = {};
          if (patientCity)
            cityStateQuery["address.city"] = new RegExp(patientCity, "i");
          if (patientState)
            cityStateQuery["address.state"] = new RegExp(patientState, "i");

          nearby = await Pharmacy.find(
            cityStateQuery,
            "_id pharmacyName"
          ).limit(10);
          console.log(
            `[CREATE_PRESCRIPTION] Found ${nearby.length} pharmacies in city/state: ${patientCity}, ${patientState}`
          );
        } else {
          // Last resort: get any approved pharmacies (limit to prevent overwhelming)
          nearby = await Pharmacy.find({}, "_id pharmacyName").limit(5);
          console.log(
            `[CREATE_PRESCRIPTION] No location data, using ${nearby.length} random pharmacies`
          );
        }
      }

      prescription.approvalRequests = nearby.map((ph) => ({
        pharmacyId: ph._id,
        status: "pending", // Explicitly set status for approval requests
      }));
      await prescription.save();
      console.log(
        "[CREATE_PRESCRIPTION] Updated prescription with approvalRequests"
      );

      return {
        success: true,
        message: "Prescription created and processing started",
        data: prescription,
      };
    } catch (error) {
      await session.abortTransaction();
      console.error(
        "[CREATE_PRESCRIPTION] Transaction aborted due to error:",
        error.message
      );
      const err = new Error(error.message || "Failed to create prescription");
      err.statusCode = error.statusCode || 500;
      throw err;
    } finally {
      session.endSession();
      console.log("[CREATE_PRESCRIPTION] Session ended");
    }
  }

  // Get approval requests for patient
  async getApprovalRequests(prescriptionId, patientId) {
    const prescription = await Prescription.findOne({
      _id: prescriptionId,
      patientId,
    })
      .populate(
        "approvalRequests.pharmacyId",
        "pharmacyName contactInfo address.city address.state"
      )
      .lean();
    if (!prescription)
      throw new Error("Prescription not found or unauthorized");
    return {
      success: true,
      data: { approvals: prescription.approvalRequests },
    };
  }

  // Pharmacy respond to approval request
  async respondApproval(prescriptionId, userId, status) {
    // Resolve pharmacy document from user
    const pharmacy = await Pharmacy.findOne({ userId });
    if (!pharmacy) throw new Error("Pharmacy not found for user");
    const pharmacyId = pharmacy._id;
    const prescription = await Prescription.findById(prescriptionId);
    if (!prescription) throw new Error("Prescription not found");
    const req = prescription.approvalRequests.find(
      (a) => a.pharmacyId.toString() === pharmacyId.toString()
    );
    if (!req) throw new Error("Approval request not found");

    console.log(
      `[RESPOND_APPROVAL] Processing approval for prescription ${prescriptionId}:`
    );
    console.log(`  Current status: ${prescription.status}`);
    console.log(`  Pharmacy response: ${status}`);
    console.log(`  OCR status: ${prescription.ocrData?.processingStatus}`);

    // Update the approval request
    req.status = status;
    req.respondedAt = new Date();

    // Update prescription status logic
    if (status === "approved") {
      // Check if OCR processing is complete and at least one pharmacy approved
      const hasApprovedPharmacy = prescription.approvalRequests.some(
        (approval) => approval.status === "approved"
      );

      const isOcrComplete =
        prescription.ocrData?.processingStatus === "completed";

      console.log(`  Has approved pharmacy: ${hasApprovedPharmacy}`);
      console.log(`  Is OCR complete: ${isOcrComplete}`);

      // Handle legacy "pending" status by updating to correct status first
      if (prescription.status === "pending") {
        prescription.status = "pending_approval";
        console.log(
          `[RESPOND_APPROVAL] Updated legacy status from "pending" to "pending_approval"`
        );
      }

      // Mark as "processed" if EITHER OCR is complete OR we have pharmacy approvals
      if (
        (hasApprovedPharmacy || isOcrComplete) &&
        prescription.status !== "processed"
      ) {
        prescription.status = "processed";
        console.log(
          `[RESPOND_APPROVAL] Prescription ${prescriptionId} status updated to "processed" - ${
            hasApprovedPharmacy && isOcrComplete
              ? "Both OCR complete and pharmacy approved"
              : hasApprovedPharmacy
              ? "Pharmacy approved (OCR pending)"
              : "OCR complete (pharmacy approval pending)"
          }`
        );

        // Sync patient history status
        await this.syncPatientHistoryStatus(prescriptionId, "processed");
      }
    }

    await prescription.save();
    console.log(`[RESPOND_APPROVAL] Final status: ${prescription.status}`);
    return { success: true, message: `Request ${status}` };
  }

  // Pharmacy fetch incoming prescription requests pending their approval
  async getIncomingRequests(userId) {
    // Resolve pharmacy document from user
    const pharmacy = await Pharmacy.findOne({ userId });
    if (!pharmacy) throw new Error("Pharmacy not found for user");
    const pharmacyId = pharmacy._id;
    // Find prescriptions where this pharmacy has a pending approval request
    const prescriptions = await Prescription.find({
      "approvalRequests.pharmacyId": pharmacyId,
      "approvalRequests.status": "pending",
    })
      .populate("patientId", "firstName lastName")
      .lean();
    // Map to request info
    const requests = prescriptions.map((p) => {
      const item = p.approvalRequests.find(
        (a) =>
          a.pharmacyId.toString() === pharmacyId.toString() &&
          a.status === "pending"
      );
      const first = p.patientId?.firstName || "";
      const last = p.patientId?.lastName || "";
      return {
        prescriptionId: p._id,
        patientName: `${first} ${last}`.trim(),
        requestedAt: item?.requestedAt,
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

    // Update prescription with selected pharmacy
    prescription.pharmacyId = pharmacyId;
    prescription.status = "accepted";
    await prescription.save();

    // Sync patient history status
    await this.syncPatientHistoryStatus(prescriptionId, "accepted");

    // Create an order for this prescription
    try {
      const orderResult = await orderController.createOrder(
        prescriptionId,
        patientId,
        pharmacyId,
        {
          orderType: "pickup", // Default to pickup, can be changed later
          paymentMethod: "cash", // Default payment method
          isUrgent: false,
        }
      );
      console.log(
        `[SELECT_PHARMACY] Order created successfully: ${orderResult.data.orderNumber}`
      );
    } catch (orderError) {
      console.error(
        `[SELECT_PHARMACY] Failed to create order: ${orderError.message}`
      );
      // Don't fail the pharmacy selection if order creation fails
    }

    // Populate pharmacy details for response
    await prescription.populate(
      "pharmacyId",
      "pharmacyName contactInfo address"
    );

    return {
      success: true,
      message: "Pharmacy selected successfully",
      data: {
        prescriptionId: prescription._id,
        selectedPharmacy: prescription.pharmacyId,
        status: prescription.status,
      },
    };
  }

  // Get prescription with order/fulfillment details for patient
  async getPrescriptionWithOrder(prescriptionId, patientId) {
    const prescription = await Prescription.findOne({
      _id: prescriptionId,
      patientId,
    })
      .populate(
        "pharmacyId",
        "pharmacyName contactInfo address.city address.state"
      )
      .populate(
        "approvalRequests.pharmacyId",
        "pharmacyName contactInfo address.city address.state"
      )
      .lean();

    if (!prescription)
      throw new Error("Prescription not found or unauthorized");

    // Get approved pharmacies
    const approvedPharmacies = prescription.approvalRequests.filter(
      (approval) => approval.status === "approved"
    );

    return {
      success: true,
      data: {
        prescription,
        selectedPharmacy: prescription.pharmacyId,
        approvedPharmacies,
        orderStatus: prescription.status,
        canPlaceOrder:
          approvedPharmacies.length > 0 && !prescription.pharmacyId,
        canChat:
          !!prescription.pharmacyId &&
          ["accepted", "preparing", "ready"].includes(prescription.status),
      },
    };
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

        // Check if any pharmacy has already approved this prescription
        const hasApprovedPharmacy = prescription.approvalRequests.some(
          (approval) => approval.status === "approved"
        );

        // Set status to "processed" since OCR is complete (regardless of pharmacy approvals)
        // OR if we have pharmacy approvals (even if OCR wasn't needed)
        prescription.status = "processed";

        // Sync patient history status
        await this.syncPatientHistoryStatus(prescriptionId, "processed");

        console.log(
          `[PROCESS_PRESCRIPTION] OCR completed for ${prescriptionId}. Status: ${prescription.status} (Has approvals: ${hasApprovedPharmacy})`
        );
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

  // Helper method to sync patient prescription history status
  async syncPatientHistoryStatus(prescriptionId, newStatus) {
    try {
      await Patient.updateMany(
        { "prescriptionHistory.prescriptionId": prescriptionId },
        { $set: { "prescriptionHistory.$.status": newStatus } }
      );
      console.log(
        `[SYNC_PATIENT_HISTORY] Updated patient history status to ${newStatus} for prescription ${prescriptionId}`
      );
    } catch (error) {
      console.error(
        `[SYNC_PATIENT_HISTORY] Error updating patient history status:`,
        error
      );
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
      processing: ["pending_approval", "processing_failed"],
      pending_approval: ["processed", "cancelled"],
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
