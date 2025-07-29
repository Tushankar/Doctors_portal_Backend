import mongoose from "mongoose";
import { Prescription } from "../models/Prescription.js";
import { ocrService } from "./ocrService.js";
import { matchDrugs } from "../utils/mlMatcher.js";
import { fileUploadService } from "./fileUploadController.js";
import Pharmacy from "../models/Pharmacy.js";
import Patient from "../models/Patient.js";
import { orderController } from "./orderController.js";
import {
  createPrescriptionApprovalNotification,
  createNewOrderNotification,
} from "./advancedNotificationController.js";
import AdvancedNotification from "../models/AdvancedNotification.js";

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

  // =============== NOTIFICATION HELPER METHODS ===============

  /**
   * Create notification when prescription is uploaded
   */
  async createPrescriptionUploadedNotification(prescription, nearbyPharmacies) {
    try {
      console.log("📤 Creating prescription uploaded notifications...");

      const patient = await Patient.findById(prescription.patientId);
      if (!patient) return;

      // Notify patient that prescription was uploaded successfully
      const patientNotification = new AdvancedNotification({
        title: "Prescription Uploaded Successfully! 📋",
        message: `Your prescription has been uploaded and sent to ${nearbyPharmacies.length} nearby pharmacies for approval. You'll be notified when pharmacies respond.`,
        type: "prescription_ready",
        priority: "medium",
        recipients: [
          {
            userId: prescription.patientId,
            userRole: "patient",
            deliveryStatus: "pending",
          },
        ],
        referenceData: {
          referenceId: prescription._id,
          referenceType: "prescription",
          metadata: {
            prescriptionId: prescription._id,
            status: "uploaded",
            pharmacyCount: nearbyPharmacies.length,
          },
        },
        channels: {
          inApp: { enabled: true },
          email: { enabled: true },
        },
        content: {
          actionButton: {
            text: "View Prescription",
            action: "navigate",
            url: `/prescriptions/${prescription._id}`,
          },
          tags: ["prescription", "uploaded", "patient"],
        },
        createdBy: {
          userId: prescription.patientId,
          userRole: "patient",
          isSystem: true,
        },
      });

      await patientNotification.save();

      // Notify nearby pharmacies about new prescription request
      for (const pharmacy of nearbyPharmacies) {
        const pharmacyNotification = new AdvancedNotification({
          title: "New Prescription Request! 🏥",
          message: `New prescription request from ${patient.firstName} ${patient.lastName}. Please review and respond.`,
          type: "new_order",
          priority: "high",
          recipients: [
            {
              userId: pharmacy.userId,
              userRole: "pharmacy",
              deliveryStatus: "pending",
            },
          ],
          referenceData: {
            referenceId: prescription._id,
            referenceType: "prescription",
            metadata: {
              prescriptionId: prescription._id,
              patientName: `${patient.firstName} ${patient.lastName}`,
              patientId: prescription.patientId,
              status: "pending_approval",
            },
          },
          channels: {
            inApp: { enabled: true },
            email: { enabled: true },
          },
          content: {
            actionButton: {
              text: "Review Prescription",
              action: "navigate",
              url: `/pharmacy/prescriptions/${prescription._id}`,
            },
            tags: ["prescription", "new_request", "pharmacy"],
          },
          createdBy: {
            userId: prescription.patientId,
            userRole: "patient",
            isSystem: true,
          },
        });

        await pharmacyNotification.save();
      }

      console.log(
        `✅ Created prescription upload notifications for patient and ${nearbyPharmacies.length} pharmacies`
      );
    } catch (error) {
      console.error(
        "❌ Error creating prescription upload notifications:",
        error
      );
    }
  }

  /**
   * Create notification when prescription processing is complete
   */
  async createPrescriptionProcessedNotification(prescription) {
    try {
      console.log("🔄 Creating prescription processed notification...");

      const notification = new AdvancedNotification({
        title: "Prescription Processing Complete! ✅",
        message: `Your prescription has been processed and analyzed. ${
          prescription.ocrData?.medications?.length || 0
        } medications were identified.`,
        type: "prescription_ready",
        priority: "medium",
        recipients: [
          {
            userId: prescription.patientId,
            userRole: "patient",
            deliveryStatus: "pending",
          },
        ],
        referenceData: {
          referenceId: prescription._id,
          referenceType: "prescription",
          metadata: {
            prescriptionId: prescription._id,
            status: "processed",
            medicationCount: prescription.ocrData?.medications?.length || 0,
            confidence: prescription.ocrData?.confidence || 0,
          },
        },
        channels: {
          inApp: { enabled: true },
          email: { enabled: true },
        },
        content: {
          actionButton: {
            text: "View Results",
            action: "navigate",
            url: `/prescriptions/${prescription._id}`,
          },
          tags: ["prescription", "processed", "patient"],
        },
        createdBy: {
          isSystem: true,
        },
      });

      await notification.save();
      console.log("✅ Created prescription processed notification");
    } catch (error) {
      console.error(
        "❌ Error creating prescription processed notification:",
        error
      );
    }
  }

  /**
   * Create notification when pharmacy responds to prescription approval
   */
  async createPharmacyResponseNotification(prescription, pharmacy, status) {
    try {
      console.log(`💊 Creating pharmacy response notification (${status})...`);

      const isApproved = status === "approved";
      const title = isApproved
        ? "Prescription Approved by Pharmacy! ✅"
        : "Prescription Response from Pharmacy 📋";

      const message = isApproved
        ? `Great news! ${pharmacy.pharmacyName} has approved your prescription. You can now proceed with ordering.`
        : `${pharmacy.pharmacyName} has responded to your prescription request. Check the details for next steps.`;

      const notification = new AdvancedNotification({
        title,
        message,
        type: "approval",
        priority: isApproved ? "high" : "medium",
        recipients: [
          {
            userId: prescription.patientId,
            userRole: "patient",
            deliveryStatus: "pending",
          },
        ],
        referenceData: {
          referenceId: prescription._id,
          referenceType: "prescription",
          metadata: {
            prescriptionId: prescription._id,
            pharmacyId: pharmacy._id,
            pharmacyName: pharmacy.pharmacyName,
            approvalStatus: status,
          },
        },
        channels: {
          inApp: { enabled: true },
          email: { enabled: true },
        },
        content: {
          actionButton: {
            text: isApproved ? "Place Order" : "View Details",
            action: "navigate",
            url: `/prescriptions/${prescription._id}`,
          },
          tags: ["prescription", "pharmacy_response", "patient"],
        },
        createdBy: {
          userId: pharmacy.userId,
          userRole: "pharmacy",
          isSystem: false,
        },
      });

      await notification.save();
      console.log("✅ Created pharmacy response notification");
    } catch (error) {
      console.error("❌ Error creating pharmacy response notification:", error);
    }
  }

  /**
   * Create notification when patient selects pharmacy for fulfillment
   */
  async createPharmacySelectedNotification(prescription, pharmacy) {
    try {
      console.log("🎯 Creating pharmacy selected notifications...");

      const patient = await Patient.findById(prescription.patientId);
      if (!patient) return;

      // Notify patient about selection confirmation
      const patientNotification = new AdvancedNotification({
        title: "Pharmacy Selected! 🏪",
        message: `You've selected ${pharmacy.pharmacyName} for your prescription fulfillment. They will prepare your order.`,
        type: "order_status",
        priority: "medium",
        recipients: [
          {
            userId: prescription.patientId,
            userRole: "patient",
            deliveryStatus: "pending",
          },
        ],
        referenceData: {
          referenceId: prescription._id,
          referenceType: "prescription",
          metadata: {
            prescriptionId: prescription._id,
            pharmacyId: pharmacy._id,
            pharmacyName: pharmacy.pharmacyName,
            status: "pharmacy_selected",
          },
        },
        channels: {
          inApp: { enabled: true },
          email: { enabled: true },
        },
        content: {
          actionButton: {
            text: "Track Order",
            action: "navigate",
            url: `/prescriptions/${prescription._id}`,
          },
          tags: ["prescription", "pharmacy_selected", "patient"],
        },
        createdBy: {
          userId: prescription.patientId,
          userRole: "patient",
          isSystem: false,
        },
      });

      // Notify pharmacy about being selected
      const pharmacyNotification = new AdvancedNotification({
        title: "Patient Selected Your Pharmacy! 🎉",
        message: `${patient.firstName} ${patient.lastName} has selected your pharmacy for prescription fulfillment. Please prepare the order.`,
        type: "new_order",
        priority: "high",
        recipients: [
          {
            userId: pharmacy.userId,
            userRole: "pharmacy",
            deliveryStatus: "pending",
          },
        ],
        referenceData: {
          referenceId: prescription._id,
          referenceType: "prescription",
          metadata: {
            prescriptionId: prescription._id,
            patientName: `${patient.firstName} ${patient.lastName}`,
            patientId: prescription.patientId,
            status: "selected_for_fulfillment",
          },
        },
        channels: {
          inApp: { enabled: true },
          email: { enabled: true },
        },
        content: {
          actionButton: {
            text: "Prepare Order",
            action: "navigate",
            url: `/pharmacy/orders/${prescription._id}`,
          },
          tags: ["prescription", "selected", "pharmacy"],
        },
        createdBy: {
          userId: prescription.patientId,
          userRole: "patient",
          isSystem: false,
        },
      });

      await Promise.all([
        patientNotification.save(),
        pharmacyNotification.save(),
      ]);
      console.log(
        "✅ Created pharmacy selected notifications for both patient and pharmacy"
      );
    } catch (error) {
      console.error(
        "❌ Error creating pharmacy selected notifications:",
        error
      );
    }
  }

  /**
   * Create notification when prescription status is updated
   */
  async createStatusUpdateNotification(prescription, newStatus, oldStatus) {
    try {
      console.log(
        `📱 Creating status update notification: ${oldStatus} → ${newStatus}`
      );

      const statusMessages = {
        processing: "Your prescription is being processed and analyzed.",
        pending_approval:
          "Your prescription has been sent to pharmacies for approval.",
        processed:
          "Your prescription analysis is complete. Waiting for pharmacy responses.",
        accepted: "Your prescription has been accepted by the pharmacy.",
        preparing: "Your prescription is being prepared by the pharmacy.",
        ready: "Your prescription is ready for pickup or delivery!",
        delivered: "Your prescription has been delivered successfully.",
        cancelled: "Your prescription has been cancelled.",
      };

      const priorityMap = {
        processing: "low",
        pending_approval: "medium",
        processed: "medium",
        accepted: "high",
        preparing: "medium",
        ready: "urgent",
        delivered: "high",
        cancelled: "urgent",
      };

      const title = `Prescription ${newStatus
        .replace("_", " ")
        .toUpperCase()} 📋`;
      const message =
        statusMessages[newStatus] ||
        `Your prescription status has been updated to ${newStatus}.`;

      const notification = new AdvancedNotification({
        title,
        message,
        type: "order_status",
        priority: priorityMap[newStatus] || "medium",
        recipients: [
          {
            userId: prescription.patientId,
            userRole: "patient",
            deliveryStatus: "pending",
          },
        ],
        referenceData: {
          referenceId: prescription._id,
          referenceType: "prescription",
          metadata: {
            prescriptionId: prescription._id,
            newStatus,
            oldStatus,
            pharmacyId: prescription.pharmacyId,
          },
        },
        channels: {
          inApp: { enabled: true },
          email: {
            enabled: newStatus === "ready" || newStatus === "delivered",
          },
          sms: { enabled: newStatus === "ready" || newStatus === "delivered" },
        },
        content: {
          actionButton: {
            text: newStatus === "ready" ? "Arrange Pickup" : "View Details",
            action: "navigate",
            url: `/prescriptions/${prescription._id}`,
          },
          tags: ["prescription", "status_update", "patient"],
        },
        createdBy: {
          isSystem: true,
        },
      });

      await notification.save();
      console.log("✅ Created status update notification");
    } catch (error) {
      console.error("❌ Error creating status update notification:", error);
    }
  }

  // =============== END NOTIFICATION METHODS ===============

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

      // Create notifications for prescription upload
      try {
        await this.createPrescriptionUploadedNotification(prescription, nearby);
      } catch (notificationError) {
        console.error(
          "[CREATE_PRESCRIPTION] Notification error:",
          notificationError
        );
        // Don't throw - prescription creation should succeed even if notifications fail
      }

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

        // Auto-create order when pharmacy approves prescription
        if (status === "approved") {
          try {
            console.log(
              `[RESPOND_APPROVAL] Creating order for approved prescription ${prescriptionId}`
            );
            const createdOrder = await this.createOrderFromApproval(
              prescription,
              pharmacyId
            );
            if (createdOrder) {
              console.log(
                `[RESPOND_APPROVAL] Order ${createdOrder._id} created successfully`
              );
            } else {
              console.log(`[RESPOND_APPROVAL] Order creation returned null`);
            }

            // Auto-share patient health records with pharmacy after approval
            await this.autoShareHealthRecords(
              prescription.patientId,
              pharmacyId
            );
            console.log(
              `[RESPOND_APPROVAL] Health records auto-shared with pharmacy ${pharmacyId}`
            );

            // Send notification to patient about prescription approval
            try {
              await createPrescriptionApprovalNotification(
                prescription.patientId,
                prescriptionId,
                pharmacyId
              );
            } catch (notificationError) {
              // Continue execution even if notification fails
            }
          } catch (orderError) {
            console.error(
              `[RESPOND_APPROVAL] Failed to create order: ${orderError.message}`
            );
          }
        }
      }
    }

    await prescription.save();
    console.log(`[RESPOND_APPROVAL] Final status: ${prescription.status}`);

    // Create comprehensive notification for pharmacy response
    try {
      const pharmacy = await Pharmacy.findById(pharmacyId);
      if (pharmacy) {
        await this.createPharmacyResponseNotification(
          prescription,
          pharmacy,
          status
        );
      }
    } catch (notificationError) {
      console.error(
        "[RESPOND_APPROVAL] Notification error:",
        notificationError
      );
      // Don't throw - approval should succeed even if notifications fail
    }

    return { success: true, message: `Request ${status}` };
  }

  // Create order automatically when pharmacy approves prescription
  async createOrderFromApproval(prescription, pharmacyId) {
    try {
      console.log(
        `[CREATE_ORDER] Auto-creating order for prescription ${prescription._id} and pharmacy ${pharmacyId}`
      );

      // Import Order model here to avoid circular dependency
      const { Order } = await import("../models/Order.js");

      // Get patient information for delivery address
      let patient;
      try {
        patient = await Patient.findById(prescription.patientId).lean();
      } catch (patientError) {
        console.warn(
          `[CREATE_ORDER] Could not fetch patient details: ${patientError.message}`
        );
      }

      // Extract medications from OCR data
      const ocrMedications = prescription.ocrData?.medications || [];
      const items = [];

      if (ocrMedications.length > 0) {
        ocrMedications.forEach((med, index) => {
          // Parse quantity from frequency/instructions
          let quantity = 30; // default
          if (
            med.frequency?.includes("twice") ||
            med.instructions?.includes("twice")
          ) {
            quantity = 60;
          } else if (
            med.frequency?.includes("three") ||
            med.instructions?.includes("three")
          ) {
            quantity = 90;
          }

          items.push({
            medicationName: med.name || `Medication ${index + 1}`,
            dosage: med.dosage || "10mg",
            quantity: quantity,
            unitPrice: 2.5 + index * 0.5, // Basic pricing
            totalPrice: (2.5 + index * 0.5) * quantity,
            notes: med.instructions || "Take as prescribed",
          });
        });
      } else {
        // Fallback if no OCR medications found
        items.push({
          medicationName: "Prescribed Medication",
          dosage: "10mg",
          quantity: 30,
          unitPrice: 3.0,
          totalPrice: 90.0,
          notes: "Take as prescribed by doctor",
        });
      }

      const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);

      // Generate unique order number
      const orderNumber = `ORD${Date.now()}${Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0")}`;

      const orderData = {
        orderNumber: orderNumber, // Explicitly set order number
        prescriptionId: prescription._id,
        patientId: prescription.patientId,
        pharmacyId: pharmacyId,
        status: "placed",
        orderType: "delivery", // Default to delivery
        totalAmount: totalAmount,
        items: items,
        deliveryInfo: {
          address: {
            street: patient?.address?.street || "Patient Address",
            city: patient?.address?.city || "City",
            state: patient?.address?.state || "State",
            zipCode: patient?.address?.zipCode || "000000",
          },
          phoneNumber:
            patient?.phoneNumber ||
            patient?.contactInfo?.phoneNumber ||
            "+91XXXXXXXXXX",
          deliveryInstructions: "Auto-created order from prescription approval",
          deliveryFee: 10.0,
        },
        paymentInfo: {
          method: "cash", // Use valid enum value instead of "pending"
          status: "pending",
          copayAmount: 0.0,
        },
      };

      console.log(`[CREATE_ORDER] Order data:`, orderData);

      // Create order and let pre-save middleware generate orderNumber
      const order = await Order.create(orderData);
      console.log(
        `[CREATE_ORDER] Order created successfully: ${order._id} with orderNumber: ${order.orderNumber} for pharmacy ${pharmacyId}`
      );

      return order;
    } catch (error) {
      console.error(`[CREATE_ORDER] Failed to create order: ${error.message}`);
      console.error(`[CREATE_ORDER] Full error:`, error);

      // Throw error instead of returning null so selectPharmacy can handle it properly
      throw error;
    }
  }

  // Pharmacy fetch incoming prescription requests pending their approval
  async getIncomingRequests(userId) {
    // Resolve pharmacy document from user
    const pharmacy = await Pharmacy.findOne({ userId });
    if (!pharmacy) throw new Error("Pharmacy not found for user");
    const pharmacyId = pharmacy._id;
    // Find prescriptions where this pharmacy has a pending approval request
    const prescriptions = await Prescription.find({
      approvalRequests: {
        $elemMatch: {
          pharmacyId: pharmacyId,
          status: "pending",
        },
      },
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
        patientId: p.patientId?._id, // Include patient ID for health records viewing
        patientName: `${first} ${last}`.trim(),
        requestedAt: item?.requestedAt,
      };
    });
    return { success: true, data: { requests } };
  }

  // Patient select pharmacy for fulfillment
  async selectPharmacy(prescriptionId, patientId, pharmacyId) {
    console.log("[SELECT_PHARMACY] Start");
    console.log("[SELECT_PHARMACY] Inputs:", {
      prescriptionId,
      patientId,
      pharmacyId,
    });

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Step 1: Fetch the prescription
      const prescription = await Prescription.findOne({
        _id: prescriptionId,
        patientId,
      }).session(session);

      if (!prescription) {
        console.error(
          "[SELECT_PHARMACY] Prescription not found or unauthorized",
          { prescriptionId, patientId }
        );
        throw new Error("Prescription not found or unauthorized");
      }

      console.log("[SELECT_PHARMACY] Prescription found:", {
        id: prescription._id,
        status: prescription.status,
      });

      // Step 2: Check if pharmacy is approved
      const approved = prescription.approvalRequests.find(
        (a) =>
          a.pharmacyId.toString() === pharmacyId.toString() &&
          a.status === "approved"
      );

      if (!approved) {
        console.warn(
          "[SELECT_PHARMACY] Pharmacy not approved:",
          pharmacyId.toString()
        );
        throw new Error("Pharmacy not approved");
      }

      console.log("[SELECT_PHARMACY] Pharmacy is approved");

      // Step 3: Store original values for rollback
      const originalPharmacyId = prescription.pharmacyId;
      const originalStatus = prescription.status;

      // Update prescription
      prescription.pharmacyId = pharmacyId;
      prescription.status = "accepted";

      await prescription.save({ session });
      console.log("[SELECT_PHARMACY] Prescription updated and saved:", {
        newPharmacyId: pharmacyId,
        newStatus: prescription.status,
      });

      // Step 4: Sync patient history
      try {
        await this.syncPatientHistoryStatus(
          prescriptionId,
          "accepted",
          pharmacyId
        );
        console.log(
          "[SELECT_PHARMACY] Patient history status synced successfully"
        );
      } catch (syncError) {
        console.error(
          "[SELECT_PHARMACY] Failed to sync patient history:",
          syncError.message
        );
        // Don't throw here as this is not critical for the main flow
      }

      // Step 5: Create order - CRITICAL STEP
      let orderResult;
      try {
        // Use our internal createOrderFromApproval method instead of orderController
        orderResult = await this.createOrderFromApproval(
          prescription,
          pharmacyId
        );

        console.log(
          "[SELECT_PHARMACY] Order created successfully:",
          orderResult.orderNumber || orderResult._id
        );
      } catch (orderError) {
        console.error(
          "[SELECT_PHARMACY] Failed to create order:",
          orderError.message
        );

        // Rollback prescription changes
        console.log(
          "[SELECT_PHARMACY] Rolling back prescription changes due to order creation failure"
        );
        throw new Error(`Failed to create order: ${orderError.message}`);
      } // Step 6: Populate pharmacy details
      try {
        await prescription.populate(
          "pharmacyId",
          "pharmacyName contactInfo address"
        );
        console.log("[SELECT_PHARMACY] Populated pharmacy details");
      } catch (populateError) {
        console.error(
          "[SELECT_PHARMACY] Failed to populate pharmacy details:",
          populateError.message
        );
        // Don't throw here as this is not critical
      }

      // Commit transaction
      await session.commitTransaction();
      console.log("[SELECT_PHARMACY] Transaction committed successfully");

      // Create notifications for pharmacy selection
      try {
        const pharmacy = await Pharmacy.findById(pharmacyId);
        if (pharmacy) {
          await this.createPharmacySelectedNotification(prescription, pharmacy);
        }
      } catch (notificationError) {
        console.error(
          "[SELECT_PHARMACY] Notification error:",
          notificationError
        );
        // Don't throw - selection should succeed even if notifications fail
      }

      // Step 7: Return success response
      const response = {
        success: true,
        message: "Pharmacy selected and order created successfully",
        data: {
          prescriptionId: prescription._id,
          selectedPharmacy: prescription.pharmacyId,
          status: prescription.status,
          orderNumber: orderResult?.orderNumber,
          orderId: orderResult?._id,
        },
      };

      console.log("[SELECT_PHARMACY] Success response:", response);
      return response;
    } catch (error) {
      await session.abortTransaction();
      console.error(
        "[SELECT_PHARMACY] Transaction aborted due to error:",
        error.message
      );
      throw error;
    } finally {
      session.endSession();
      console.log("[SELECT_PHARMACY] Session ended");
    }
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
   * Process prescription with enhanced OCR and validation
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

      console.log(
        `🔄 Starting enhanced OCR processing for prescription ${prescriptionId}`
      );

      // Perform enhanced OCR with improved handwritten/digital text handling
      const ocrResult = await ocrService.processPrescriptionImage(
        prescription.originalFile.secureUrl,
        { enhanced: true, includeMetadata: true }
      );

      console.log(`📊 OCR processing completed:`, {
        confidence: ocrResult.confidence,
        textType: ocrResult.metadata?.textType,
        approach: ocrResult.metadata?.ocrApproach,
        medicationCount: ocrResult.medications?.length || 0,
      });

      // Enhanced medication matching with improved database lookup
      if (ocrResult && Array.isArray(ocrResult.medications)) {
        console.log(
          `🔍 Matching ${ocrResult.medications.length} medications against drug database...`
        );
        ocrResult.medications = await matchDrugs(ocrResult.medications);

        // Post-process medications with additional validation
        ocrResult.medications = this.enhanceMedicationData(
          ocrResult.medications,
          ocrResult.metadata
        );
      }

      prescription.ocrData = ocrResult;
      console.log(`processPrescription OCR result for ${prescriptionId}:`, {
        status: ocrResult.processingStatus,
        confidence: ocrResult.confidence,
        medicationCount: ocrResult.medications?.length || 0,
        warnings: ocrResult.warnings?.length || 0,
      });

      // Enhanced validation results based on OCR output and metadata
      if (
        ocrResult.processingStatus === "completed" &&
        ocrResult.medications.length > 0
      ) {
        const validationResults =
          this.generateEnhancedValidationResults(ocrResult);
        prescription.validationResults = validationResults;

        // Check if any pharmacy has already approved this prescription
        const hasApprovedPharmacy = prescription.approvalRequests.some(
          (approval) => approval.status === "approved"
        );

        // Set status based on validation quality and confidence
        if (
          validationResults.aiConfidence >= 0.7 &&
          !validationResults.reviewRequired
        ) {
          prescription.status = "processed";
        } else if (validationResults.aiConfidence >= 0.4) {
          prescription.status = "pending_review";
        } else {
          prescription.status = "processing_failed";
        }

        // Sync patient history status
        await this.syncPatientHistoryStatus(
          prescriptionId,
          prescription.status
        );

        console.log(
          `[PROCESS_PRESCRIPTION] Enhanced OCR completed for ${prescriptionId}. Status: ${
            prescription.status
          } (Confidence: ${validationResults.aiConfidence.toFixed(
            2
          )}, Has approvals: ${hasApprovedPharmacy})`
        );
      } else {
        prescription.status = "processing_failed";
        prescription.validationResults = {
          isValid: false,
          flags: [
            {
              type: "processing_error",
              severity: "high",
              message:
                "Failed to extract medications from prescription using enhanced OCR",
              confidence: 1,
              details:
                ocrResult.processingError ||
                "Unknown error during OCR processing",
            },
          ],
          aiConfidence: 0,
          reviewRequired: true,
          validatedAt: new Date(),
          ocrMetadata: ocrResult.metadata,
        };
      }

      await prescription.save();

      const processingTime = Date.now() - startTime;
      console.log(
        `processPrescription completed for ${prescriptionId} in ${processingTime}ms`
      );

      // Create enhanced notification for prescription processing completion
      try {
        if (prescription.status === "processed") {
          await this.createPrescriptionProcessedNotification(prescription);
        } else if (prescription.status === "pending_review") {
          await this.createPrescriptionReviewNotification(prescription);
        }
      } catch (notificationError) {
        console.error(
          "Error creating processing notification:",
          notificationError
        );
      }

      return {
        success: true,
        prescription,
        ocrResult,
        processingTime,
      };
    } catch (error) {
      console.error(`processPrescription failed for ${prescriptionId}:`, error);

      // Update prescription status to failed
      try {
        await Prescription.findByIdAndUpdate(prescriptionId, {
          status: "processing_failed",
          "ocrData.processingStatus": "failed",
          "ocrData.processingError": error.message,
          "validationResults.isValid": false,
          "validationResults.reviewRequired": true,
        });
      } catch (updateError) {
        console.error("Failed to update prescription status:", updateError);
      }

      const processingTime = Date.now() - startTime;
      return {
        success: false,
        error: error.message,
        processingTime,
      };
    }
  }

  /**
   * Generate enhanced validation results based on OCR output
   */
  generateEnhancedValidationResults(ocrResult) {
    const flags = [];
    let reviewRequired = false;
    let isValid = true;

    // Analyze OCR confidence and quality
    if (ocrResult.confidence < 0.5) {
      flags.push({
        type: "low_confidence",
        severity: "high",
        message: "Very low OCR confidence. Manual review strongly recommended.",
        confidence: 1,
        details: `OCR confidence: ${(ocrResult.confidence * 100).toFixed(1)}%`,
      });
      reviewRequired = true;
      isValid = false;
    } else if (ocrResult.confidence < 0.7) {
      flags.push({
        type: "medium_confidence",
        severity: "medium",
        message: "Medium OCR confidence. Review recommended.",
        confidence: 0.8,
        details: `OCR confidence: ${(ocrResult.confidence * 100).toFixed(1)}%`,
      });
    }

    // Analyze text type and processing approach
    if (ocrResult.metadata?.textType === "handwritten") {
      flags.push({
        type: "handwritten_text",
        severity: "medium",
        message:
          "Handwritten prescription detected. Additional verification recommended.",
        confidence: 0.7,
      });
    }

    // Check for OCR warnings
    if (ocrResult.warnings && ocrResult.warnings.length > 0) {
      ocrResult.warnings.forEach((warning) => {
        flags.push({
          type: "ocr_warning",
          severity: warning.includes("Very low") ? "high" : "medium",
          message: warning,
          confidence: 0.6,
        });
        if (
          warning.includes("Very low") ||
          warning.includes("strongly recommended")
        ) {
          reviewRequired = true;
        }
      });
    }

    // Analyze medication completeness
    const incompleteMedications = ocrResult.medications.filter(
      (med) => med.dosage === "as prescribed" || med.frequency === "as directed"
    );

    if (incompleteMedications.length > 0) {
      flags.push({
        type: "incomplete_medication_info",
        severity: "medium",
        message: `${incompleteMedications.length} medication(s) have incomplete dosage or frequency information.`,
        confidence: 0.8,
      });
    }

    // Check for very low medication confidence
    const lowConfidenceMeds = ocrResult.medications.filter(
      (med) => med.confidence < 0.4
    );
    if (lowConfidenceMeds.length > 0) {
      flags.push({
        type: "low_medication_confidence",
        severity: "high",
        message: `${lowConfidenceMeds.length} medication(s) have very low confidence scores.`,
        confidence: 0.9,
      });
      reviewRequired = true;
    }

    return {
      isValid,
      flags,
      aiConfidence: ocrResult.confidence,
      reviewRequired,
      validatedAt: new Date(),
      ocrMetadata: ocrResult.metadata,
      processingApproach: ocrResult.metadata?.ocrApproach || "standard",
    };
  }

  /**
   * Enhance medication data with additional processing
   */
  enhanceMedicationData(medications, metadata) {
    return medications.map((medication) => {
      let enhancedMedication = { ...medication };

      // Boost confidence for well-structured medications
      if (medication.name && medication.dosage && medication.frequency) {
        if (
          medication.dosage !== "as prescribed" &&
          medication.frequency !== "as directed"
        ) {
          enhancedMedication.confidence = Math.min(
            medication.confidence + 0.1,
            1.0
          );
        }
      }

      // Add metadata tags
      enhancedMedication.processingTags = [];

      if (metadata?.textType === "handwritten") {
        enhancedMedication.processingTags.push("handwritten-source");
      }

      if (medication.confidence < 0.5) {
        enhancedMedication.processingTags.push("requires-verification");
      }

      if (enhancedMedication.processingTags.length === 0) {
        enhancedMedication.processingTags.push("standard-processing");
      }

      return enhancedMedication;
    });
  }

  /**
   * Create notification when prescription requires review
   */
  async createPrescriptionReviewNotification(prescription) {
    try {
      console.log("📋 Creating prescription review notification...");

      const notification = new AdvancedNotification({
        title: "Prescription Requires Review 🔍",
        message: `Your prescription has been processed but requires manual review due to low confidence or handwritten text. Our team will review it shortly.`,
        type: "prescription_review",
        priority: "medium",
        recipients: [
          {
            userId: prescription.patientId,
            userRole: "patient",
            deliveryStatus: "pending",
          },
        ],
        referenceData: {
          referenceId: prescription._id,
          referenceType: "prescription",
          metadata: {
            prescriptionId: prescription._id,
            status: "pending_review",
            confidence: prescription.ocrData?.confidence || 0,
            textType: prescription.ocrData?.metadata?.textType || "unknown",
          },
        },
        channels: {
          inApp: { enabled: true },
          email: { enabled: true },
        },
        content: {
          actionButton: {
            text: "View Details",
            action: "navigate",
            url: `/prescriptions/${prescription._id}`,
          },
          tags: ["prescription", "review_required", "patient"],
        },
        createdBy: {
          isSystem: true,
        },
      });

      await notification.save();
      console.log("✅ Created prescription review notification");
    } catch (error) {
      console.error(
        "❌ Error creating prescription review notification:",
        error
      );
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

      // Store old status for notifications
      const oldStatus = prescription.status;

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

      // Create notification for status update (after successful commit)
      try {
        if (oldStatus !== status) {
          await this.createStatusUpdateNotification(
            prescription,
            status,
            oldStatus
          );
        }
      } catch (notificationError) {
        console.error("[UPDATE_STATUS] Notification error:", notificationError);
        // Don't throw - status update should succeed even if notifications fail
      }

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
  async syncPatientHistoryStatus(prescriptionId, newStatus, pharmacyId = null) {
    try {
      const updateQuery = {
        "prescriptionHistory.prescriptionId": prescriptionId,
      };

      const updateData = {
        $set: { "prescriptionHistory.$.status": newStatus },
      };

      // If pharmacyId is provided, also update the fulfilledBy field
      if (pharmacyId) {
        updateData.$set["prescriptionHistory.$.fulfilledBy"] = pharmacyId;
      }

      await Patient.updateMany(updateQuery, updateData);

      console.log(
        `[SYNC_PATIENT_HISTORY] Updated patient history status to ${newStatus} for prescription ${prescriptionId}${
          pharmacyId ? ` with pharmacy ${pharmacyId}` : ""
        }`
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

  // Helper method to fix missing fulfilledBy data for existing orders
  async fixMissingFulfilledByData() {
    try {
      console.log(
        "[FIX_FULFILLED_BY] Starting to fix missing fulfilledBy data..."
      );

      // Find prescriptions that have a pharmacyId but patient history doesn't have fulfilledBy
      const prescriptionsWithPharmacy = await Prescription.find({
        pharmacyId: { $exists: true, $ne: null },
        status: {
          $in: ["accepted", "preparing", "ready", "delivered", "completed"],
        },
      }).select("_id patientId pharmacyId status");

      console.log(
        `[FIX_FULFILLED_BY] Found ${prescriptionsWithPharmacy.length} prescriptions with pharmacy`
      );

      for (const prescription of prescriptionsWithPharmacy) {
        // Update patient history to include the fulfilledBy field
        await Patient.updateMany(
          {
            "prescriptionHistory.prescriptionId": prescription._id,
            "prescriptionHistory.fulfilledBy": { $exists: false },
          },
          {
            $set: {
              "prescriptionHistory.$.fulfilledBy": prescription.pharmacyId,
            },
          }
        );

        console.log(
          `[FIX_FULFILLED_BY] Updated fulfilledBy for prescription ${prescription._id}`
        );
      }

      console.log("[FIX_FULFILLED_BY] Completed fixing fulfilledBy data");
      return { success: true, fixed: prescriptionsWithPharmacy.length };
    } catch (error) {
      console.error("[FIX_FULFILLED_BY] Error fixing fulfilledBy data:", error);
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

  // Auto-share patient health records with pharmacy after prescription approval
  async autoShareHealthRecords(patientId, pharmacyId) {
    try {
      console.log(
        `[AUTO_SHARE] Starting health records sharing for patient ${patientId} with pharmacy ${pharmacyId}`
      );

      const patient = await Patient.findById(patientId);
      if (!patient) {
        console.error(`[AUTO_SHARE] Patient not found: ${patientId}`);
        return;
      }

      console.log(
        `[AUTO_SHARE] Patient found: ${patient.firstName} ${patient.lastName}`
      );

      const pharmacy = await Pharmacy.findById(pharmacyId);
      if (!pharmacy) {
        console.error(`[AUTO_SHARE] Pharmacy not found: ${pharmacyId}`);
        return;
      }

      console.log(`[AUTO_SHARE] Pharmacy found: ${pharmacy.pharmacyName}`);

      let recordsShared = 0;

      // Check existing health records
      console.log(`[AUTO_SHARE] Checking patient health records:`, {
        medicalHistory: patient.medicalHistory?.length || 0,
        allergies: patient.allergies?.length || 0,
        currentMedications: patient.currentMedications?.length || 0,
        vitalSigns: patient.vitalSigns?.length || 0,
        emergencyContacts: patient.emergencyContacts?.length || 0,
      });

      // Auto-share all medical history records
      if (patient.medicalHistory && patient.medicalHistory.length > 0) {
        console.log(
          `[AUTO_SHARE] Processing ${patient.medicalHistory.length} medical history records`
        );
        patient.medicalHistory.forEach((record, index) => {
          console.log(`[AUTO_SHARE] Medical history record ${index + 1}:`, {
            condition: record.condition,
            hasSharedWithPharmacies: !!record.sharedWithPharmacies,
            currentShares: record.sharedWithPharmacies?.length || 0,
          });

          const existingShare = record.sharedWithPharmacies?.find(
            (share) => share.pharmacyId.toString() === pharmacyId.toString()
          );

          if (!existingShare) {
            console.log(
              `[AUTO_SHARE] Adding new share for medical history record ${
                index + 1
              }`
            );
            if (!record.sharedWithPharmacies) {
              record.sharedWithPharmacies = [];
            }
            record.sharedWithPharmacies.push({
              pharmacyId: pharmacyId,
              sharedAt: new Date(),
              approvalStatus: "approved", // Auto-approve since prescription was mutually approved
            });
            recordsShared++;
          } else {
            console.log(
              `[AUTO_SHARE] Medical history record ${
                index + 1
              } already shared with this pharmacy`
            );
          }
        });
      } else {
        console.log(`[AUTO_SHARE] No medical history records to share`);
      }

      // Auto-share all allergy records
      if (patient.allergies && patient.allergies.length > 0) {
        console.log(
          `[AUTO_SHARE] Processing ${patient.allergies.length} allergy records`
        );
        patient.allergies.forEach((record, index) => {
          const existingShare = record.sharedWithPharmacies?.find(
            (share) => share.pharmacyId.toString() === pharmacyId.toString()
          );

          if (!existingShare) {
            console.log(
              `[AUTO_SHARE] Adding new share for allergy record ${index + 1}`
            );
            if (!record.sharedWithPharmacies) {
              record.sharedWithPharmacies = [];
            }
            record.sharedWithPharmacies.push({
              pharmacyId: pharmacyId,
              sharedAt: new Date(),
              approvalStatus: "approved",
            });
            recordsShared++;
          }
        });
      }

      // Auto-share all current medications
      if (patient.currentMedications && patient.currentMedications.length > 0) {
        console.log(
          `[AUTO_SHARE] Processing ${patient.currentMedications.length} current medication records`
        );
        patient.currentMedications.forEach((record, index) => {
          const existingShare = record.sharedWithPharmacies?.find(
            (share) => share.pharmacyId.toString() === pharmacyId.toString()
          );

          if (!existingShare) {
            console.log(
              `[AUTO_SHARE] Adding new share for medication record ${index + 1}`
            );
            if (!record.sharedWithPharmacies) {
              record.sharedWithPharmacies = [];
            }
            record.sharedWithPharmacies.push({
              pharmacyId: pharmacyId,
              sharedAt: new Date(),
              approvalStatus: "approved",
            });
            recordsShared++;
          }
        });
      }

      // Auto-share vital signs
      if (patient.vitalSigns && patient.vitalSigns.length > 0) {
        console.log(
          `[AUTO_SHARE] Processing ${patient.vitalSigns.length} vital signs records`
        );
        patient.vitalSigns.forEach((record, index) => {
          const existingShare = record.sharedWithPharmacies?.find(
            (share) => share.pharmacyId.toString() === pharmacyId.toString()
          );

          if (!existingShare) {
            console.log(
              `[AUTO_SHARE] Adding new share for vital signs record ${
                index + 1
              }`
            );
            if (!record.sharedWithPharmacies) {
              record.sharedWithPharmacies = [];
            }
            record.sharedWithPharmacies.push({
              pharmacyId: pharmacyId,
              sharedAt: new Date(),
              approvalStatus: "approved",
            });
            recordsShared++;
          }
        });
      }

      // Auto-share emergency contacts
      if (patient.emergencyContacts && patient.emergencyContacts.length > 0) {
        console.log(
          `[AUTO_SHARE] Processing ${patient.emergencyContacts.length} emergency contact records`
        );
        patient.emergencyContacts.forEach((record, index) => {
          const existingShare = record.sharedWithPharmacies?.find(
            (share) => share.pharmacyId.toString() === pharmacyId.toString()
          );

          if (!existingShare) {
            console.log(
              `[AUTO_SHARE] Adding new share for emergency contact record ${
                index + 1
              }`
            );
            if (!record.sharedWithPharmacies) {
              record.sharedWithPharmacies = [];
            }
            record.sharedWithPharmacies.push({
              pharmacyId: pharmacyId,
              sharedAt: new Date(),
              approvalStatus: "approved",
            });
            recordsShared++;
          }
        });
      }

      console.log(
        `[AUTO_SHARE] About to save patient with ${recordsShared} new shared records`
      );
      await patient.save();
      console.log(
        `[AUTO_SHARE] Successfully shared ${recordsShared} health records with pharmacy ${pharmacyId}`
      );
    } catch (error) {
      console.error(
        `[AUTO_SHARE] Error sharing health records: ${error.message}`
      );
      // Don't throw error to prevent breaking the approval process
    }
  }
}

// Export singleton instance
export const prescriptionController = new PrescriptionController();
