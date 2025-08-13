import mongoose from "mongoose";
import { sendEmail } from "./contactController.js";
import { Order } from "../models/Order.js";
import Pharmacy from "../models/Pharmacy.js";
import User from "../models/User.js"; // Import User first for discriminator
import Patient from "../models/Patient.js";
import { Prescription } from "../models/Prescription.js";
import {
  createRefillResponseNotification,
  createRefillRequestNotification,
} from "../utils/refillNotifications.js";

// Refill Request Schema
const RefillRequestSchema = new mongoose.Schema(
  {
    originalOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    prescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Prescription",
      required: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Use User since Patient is a discriminator
      required: true,
    },
    pharmacyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pharmacy",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    medications: [
      {
        name: String,
        dosage: String,
        frequency: String,
        duration: String,
        instructions: String,
      },
    ],
    notes: String,
    pharmacyResponse: {
      message: String,
      respondedAt: Date,
      respondedBy: String,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const RefillRequest = mongoose.model("RefillRequest", RefillRequestSchema);

// Debug: Log RefillRequest model info
console.log("🏗️ RefillRequest Model Info:");
console.log("- Model name:", RefillRequest.modelName);
console.log("- Collection name:", RefillRequest.collection.name);
console.log("- Schema paths:", Object.keys(RefillRequest.schema.paths));

// Create refill request
export const createRefillRequest = async (req, res) => {
  try {
    console.log("=========== CREATE REFILL REQUEST START ===========");
    console.log("📥 Request Body:", JSON.stringify(req.body, null, 2));
    console.log("👤 Requesting User ID:", req.user?.id);

    const { originalOrderId, prescriptionId, pharmacyId, medications, notes } =
      req.body;
    const patientId = req.user?.id;

    if (!originalOrderId || !prescriptionId || !pharmacyId) {
      console.warn("❌ Missing required fields");
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: originalOrderId, prescriptionId, or pharmacyId",
      });
    }

    console.log("🔍 Validating original order:", originalOrderId);
    const originalOrder = await Order.findById(originalOrderId)
      .populate("patientId")
      .populate("pharmacyId");

    if (!originalOrder) {
      console.warn("❌ Original order not found");
      return res.status(404).json({
        success: false,
        message: "Original order not found",
      });
    }

    console.log("✅ Found original order. Order status:", originalOrder.status);
    console.log(
      "🆔 Order belongs to patient:",
      originalOrder.patientId?._id?.toString()
    );

    if (originalOrder.patientId._id.toString() !== patientId) {
      console.warn("❌ Unauthorized: patient ID mismatch");
      return res.status(403).json({
        success: false,
        message: "Unauthorized to request refill for this order",
      });
    }

    const allowedStatuses = ["delivered", "completed"];
    if (!allowedStatuses.includes(originalOrder.status)) {
      console.warn(
        "❌ Order status not eligible for refill:",
        originalOrder.status
      );
      return res.status(400).json({
        success: false,
        message: `Cannot request refill for order with status: ${originalOrder.status}.`,
      });
    }

    console.log("✅ Order status allows refill");

    const medicationsArray = Array.isArray(medications) ? medications : [];
    console.log("💊 Medications array validated:", medicationsArray);

    console.log("🔎 Checking for existing pending refill requests...");
    console.log("🔍 Query parameters:", { originalOrderId, status: "pending" });

    // Test RefillRequest model first with a simple count
    try {
      console.log("🧪 Testing RefillRequest model with count query...");
      const totalCount = await RefillRequest.countDocuments({}).maxTimeMS(3000);
      console.log(
        "✅ RefillRequest model working. Total documents:",
        totalCount
      );
    } catch (countError) {
      console.error("❌ RefillRequest model test failed:", countError);
      return res.status(500).json({
        success: false,
        message: "RefillRequest model is not accessible",
        error: countError.message,
      });
    }

    let existingRequest;
    try {
      console.log("🕐 Starting database query for existing requests...");
      existingRequest = await RefillRequest.findOne({
        originalOrderId,
        status: "pending",
      }).maxTimeMS(5000); // 5 second timeout
      console.log("✅ Database query completed");
      console.log(
        "🔍 Existing request result:",
        existingRequest ? "Found" : "Not found"
      );
    } catch (queryError) {
      console.error("❌ Database query error:", queryError);
      return res.status(500).json({
        success: false,
        message: "Database error while checking existing requests",
        error: queryError.message,
      });
    }

    if (existingRequest) {
      console.warn("❌ Existing pending request found:", existingRequest._id);
      return res.status(400).json({
        success: false,
        message: "A refill request is already pending for this order",
      });
    }

    console.log("✅ No existing pending refill request");

    const refillData = {
      originalOrderId,
      prescriptionId,
      patientId,
      pharmacyId,
      medications: medicationsArray,
      notes,
    };
    console.log(
      "🛠️ Constructed refill request object:",
      JSON.stringify(refillData, null, 2)
    );

    const refillRequest = new RefillRequest(refillData);

    console.log("💾 Saving refill request...");
    try {
      await refillRequest.save();
      console.log("✅ Refill request saved. ID:", refillRequest._id);
    } catch (saveError) {
      console.error("❌ Error saving refill request:", saveError);
      return res.status(400).json({
        success: false,
        message: "Failed to save refill request",
        error: saveError.message,
        details: saveError.errors,
      });
    }

    console.log("🔄 Populating saved refill request...");
    const populatedRequest = await RefillRequest.findById(refillRequest._id)
      .populate("patientId", "firstName lastName email")
      .populate("pharmacyId", "pharmacyName email")
      .populate("originalOrderId")
      .populate("prescriptionId");

    console.log(
      "✅ Populated request:",
      JSON.stringify(populatedRequest, null, 2)
    );

    console.log("📢 Creating notification for pharmacy...");
    try {
      await createRefillRequestNotification(populatedRequest);
      console.log("✅ Notification created");
    } catch (notificationError) {
      console.error(
        "⚠️ Notification failed (non-blocking):",
        notificationError
      );
    }

    console.log("📧 Sending email notification to pharmacy...");
    try {
      await sendRefillRequestEmailToPharmacy(populatedRequest);
      console.log("✅ Email sent to pharmacy");
    } catch (emailError) {
      console.error("⚠️ Email failed (non-blocking):", emailError);
    }

    console.log(
      "🎉 Refill request completed successfully. Sending response..."
    );
    console.log("=========== CREATE REFILL REQUEST END ===========");

    res.status(201).json({
      success: true,
      message: "Refill request created successfully",
      data: populatedRequest,
    });
  } catch (error) {
    console.error("❌ Internal server error in createRefillRequest:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create refill request",
      error: error.message,
    });
  }
};

// Get refill requests for pharmacy
export const getPharmacyRefillRequests = async (req, res) => {
  try {
    const pharmacy = await Pharmacy.findOne({ userId: req.user.id });

    if (pharmacy) {
      console.log("Pharmacy ID:", pharmacy._id);
    } else {
      console.log("No pharmacy found with the given userId.");
    }

    const pharmacyId = pharmacy._id;
    const { status = "pending" } = req.query;

    const refillRequests = await RefillRequest.find({
      pharmacyId,
      ...(status !== "all" && { status }),
    })
      .populate("patientId", "firstName lastName email phone")
      .populate("originalOrderId")
      .populate("prescriptionId")
      .sort({ requestedAt: -1 });
    console.log(
      "F==========================================================etched refill requests for pharmacy:",
      pharmacyId,
      refillRequests
    );

    res.json({
      success: true,
      data: refillRequests,
    });
  } catch (error) {
    console.error("Get pharmacy refill requests error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch refill requests",
      error: error.message,
    });
  }
};

// Count pending refill requests for pharmacy
export const getPharmacyRefillRequestCount = async (req, res) => {
  try {
    const pharmacyId = req.user.pharmacyId || req.user.id;

    const count = await RefillRequest.countDocuments({
      pharmacyId,
      status: "pending",
    });

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    console.error("Get refill request count error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get refill request count",
      error: error.message,
    });
  }
};

// Respond to refill request (approve/reject)
export const respondToRefillRequest = async (req, res) => {
  try {
    console.log("=========== RESPOND TO REFILL REQUEST START ===========");
    console.log("📥 Params:", req.params);
    console.log("📥 Body:", req.body);
    console.log("👤 Responding Pharmacy User ID:", req.user?.id);

    const { refillId } = req.params;
    const { status, message } = req.body;
    const pharmacyUserId = req.user.id;

    // Validate status
    if (!["approved", "rejected"].includes(status)) {
      console.warn("❌ Invalid status received:", status);
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be 'approved' or 'rejected'",
      });
    }
    console.log("✅ Status validated:", status);

    // Find the refill request
    console.log("🔍 Finding refill request with ID:", refillId);
    const refillRequest = await RefillRequest.findById(refillId)
      .populate("patientId", "firstName lastName email")
      .populate("pharmacyId", "pharmacyName email userId")
      .populate("originalOrderId")
      .populate("prescriptionId");

    if (!refillRequest) {
      console.warn("❌ Refill request not found for ID:", refillId);
      return res.status(404).json({
        success: false,
        message: "Refill request not found",
      });
    }

    console.log("✅ Refill request found:", refillRequest._id);
    console.log("📦 Current refill request status:", refillRequest.status);

    // Check if request is still pending
    if (refillRequest.status !== "pending") {
      console.warn("⚠️ Refill already processed:", refillRequest.status);
      return res.status(400).json({
        success: false,
        message: "Refill request has already been processed",
      });
    }

    // Verify pharmacy ownership
    const refillPharmacyId = refillRequest.pharmacyId?._id?.toString();
    const refillPharmacyUserId = refillRequest.pharmacyId?.userId?.toString();

    console.log("🏪 Request's pharmacy ID:", refillPharmacyId);
    console.log("🏪 Request's pharmacy.userId:", refillPharmacyUserId);
    console.log("🧾 Requester (pharmacy) user ID:", pharmacyUserId);

    if (
      refillPharmacyId !== pharmacyUserId &&
      refillPharmacyUserId !== pharmacyUserId
    ) {
      console.warn("❌ Unauthorized: pharmacy mismatch");
      return res.status(403).json({
        success: false,
        message: "Unauthorized to respond to this refill request",
      });
    }

    console.log("✅ Authorized to respond to refill request");

    // Update refill request
    console.log("📝 Updating refill request status to:", status);
    refillRequest.status = status;
    refillRequest.pharmacyResponse = {
      message,
      respondedAt: new Date(),
      respondedBy: pharmacyUserId,
    };

    console.log("💾 Saving updated refill request...");
    await refillRequest.save();
    console.log("✅ Refill request saved");

    console.log("📢 Creating notification for patient...");
    try {
      await createRefillResponseNotification(refillRequest, status, message);
      console.log("✅ Notification sent to patient");
    } catch (notificationError) {
      console.error(
        "⚠️ Notification failed (non-blocking):",
        notificationError
      );
    }

    // Email to patient
    console.log("📧 Sending email response to patient...");
    await sendRefillResponseEmailToPatient(refillRequest, status);
    console.log("✅ Email sent successfully");

    console.log("🎉 Respond to refill request completed successfully.");
    console.log("=========== RESPOND TO REFILL REQUEST END ===========");

    res.json({
      success: true,
      message: `Refill request ${status} successfully`,
      data: refillRequest,
    });
  } catch (error) {
    console.error("❌ Respond to refill request error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to respond to refill request",
      error: error.message,
    });
  }
};

// Get patient's refill requests
export const getPatientRefillRequests = async (req, res) => {
  try {
    const patientId = req.user.id;
    const { status } = req.query;

    const refillRequests = await RefillRequest.find({
      patientId,
      ...(status && { status }),
    })
      .populate("pharmacyId", "pharmacyName address phone")
      .populate("originalOrderId")
      .populate("prescriptionId")
      .sort({ requestedAt: -1 });

    res.json({
      success: true,
      data: refillRequests,
    });
  } catch (error) {
    console.error("Get patient refill requests error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch refill requests",
      error: error.message,
    });
  }
};

// Email helper functions
const sendRefillRequestEmailToPharmacy = async (refillRequest) => {
  try {
    const { patientId, pharmacyId, originalOrderId, medications } =
      refillRequest;

    const emailData = {
      to: pharmacyId.email,
      subject: `New Refill Request - Order #${originalOrderId._id}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
          <div style="background: linear-gradient(135deg, #115E59 0%, #0F4C47 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: #FDE047; margin: 0; font-size: 28px; font-weight: bold;">
              New Refill Request
            </h1>
            <p style="color: #DBF5F0; margin: 10px 0 0 0; font-size: 16px;">
              A patient has requested a medication refill
            </p>
          </div>
          
          <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="margin-bottom: 25px;">
              <h2 style="color: #115E59; margin-bottom: 15px; font-size: 22px;">Patient Information</h2>
              <p style="margin: 5px 0; color: #333;"><strong>Name:</strong> ${
                patientId.firstName
              } ${patientId.lastName}</p>
              <p style="margin: 5px 0; color: #333;"><strong>Email:</strong> ${
                patientId.email
              }</p>
              <p style="margin: 5px 0; color: #333;"><strong>Original Order:</strong> #${
                originalOrderId._id
              }</p>
            </div>

            <div style="margin-bottom: 25px;">
              <h2 style="color: #115E59; margin-bottom: 15px; font-size: 22px;">Requested Medications</h2>
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #115E59;">
                ${medications
                  .map(
                    (med) => `
                  <div style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #e9ecef;">
                    <p style="margin: 3px 0; color: #333;"><strong>${
                      med.name
                    }</strong></p>
                    <p style="margin: 3px 0; color: #666; font-size: 14px;">Dosage: ${
                      med.dosage
                    } | Frequency: ${med.frequency}</p>
                    ${
                      med.instructions
                        ? `<p style="margin: 3px 0; color: #666; font-size: 14px;">Instructions: ${med.instructions}</p>`
                        : ""
                    }
                  </div>
                `
                  )
                  .join("")}
              </div>
            </div>

            ${
              refillRequest.notes
                ? `
            <div style="margin-bottom: 25px;">
              <h2 style="color: #115E59; margin-bottom: 15px; font-size: 22px;">Additional Notes</h2>
              <p style="color: #333; background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 0;">
                ${refillRequest.notes}
              </p>
            </div>
            `
                : ""
            }

            <div style="text-align: center; margin-top: 30px;">
              <p style="color: #666; margin-bottom: 20px;">Please review this refill request in your pharmacy dashboard.</p>
              <div style="background: linear-gradient(135deg, #FDE047 0%, #F59E0B 100%); display: inline-block; padding: 15px 30px; border-radius: 25px; text-decoration: none; color: #115E59; font-weight: bold; font-size: 16px;">
                ✓ Review Refill Request
              </div>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #666; font-size: 14px;">
            <p>This is an automated message from DoctorPortal Pharmacy System</p>
          </div>
        </div>
      `,
    };

    await sendEmail(emailData);
  } catch (error) {
    console.error("Failed to send refill request email to pharmacy:", error);
  }
};

const sendRefillResponseEmailToPatient = async (refillRequest, status) => {
  try {
    const { patientId, pharmacyId, originalOrderId } = refillRequest;
    const isApproved = status === "approved";

    const emailData = {
      to: patientId.email,
      subject: `Refill Request ${
        isApproved ? "Approved" : "Declined"
      } - Order #${originalOrderId._id}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
          <div style="background: linear-gradient(135deg, ${
            isApproved ? "#10B981" : "#EF4444"
          } 0%, ${
        isApproved ? "#059669" : "#DC2626"
      } 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">
              Refill Request ${isApproved ? "Approved" : "Declined"}
            </h1>
            <p style="color: #f0f0f0; margin: 10px 0 0 0; font-size: 16px;">
              ${pharmacyId.pharmacyName} has ${
        isApproved ? "approved" : "declined"
      } your refill request
            </p>
          </div>
          
          <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="margin-bottom: 25px;">
              <h2 style="color: #115E59; margin-bottom: 15px; font-size: 22px;">Request Details</h2>
              <p style="margin: 5px 0; color: #333;"><strong>Pharmacy:</strong> ${
                pharmacyId.pharmacyName
              }</p>
              <p style="margin: 5px 0; color: #333;"><strong>Original Order:</strong> #${
                originalOrderId._id
              }</p>
              <p style="margin: 5px 0; color: #333;"><strong>Status:</strong> 
                <span style="color: ${
                  isApproved ? "#10B981" : "#EF4444"
                }; font-weight: bold;">
                  ${isApproved ? "APPROVED" : "DECLINED"}
                </span>
              </p>
            </div>

            ${
              refillRequest.pharmacyResponse?.message
                ? `
            <div style="margin-bottom: 25px;">
              <h2 style="color: #115E59; margin-bottom: 15px; font-size: 22px;">Pharmacy Response</h2>
              <p style="color: #333; background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 0; border-left: 4px solid ${
                isApproved ? "#10B981" : "#EF4444"
              };">
                ${refillRequest.pharmacyResponse.message}
              </p>
            </div>
            `
                : ""
            }

            <div style="text-align: center; margin-top: 30px;">
              ${
                isApproved
                  ? `
                <p style="color: #10B981; margin-bottom: 20px; font-weight: bold; font-size: 18px;">
                  ✓ Your refill has been approved!
                </p>
                <p style="color: #666; margin-bottom: 20px;">
                  You can now proceed with the refill process. Please contact the pharmacy for pickup details.
                </p>
              `
                  : `
                <p style="color: #EF4444; margin-bottom: 20px; font-weight: bold; font-size: 18px;">
                  ✗ Your refill request was declined
                </p>
                <p style="color: #666; margin-bottom: 20px;">
                  Please contact the pharmacy directly for more information or to discuss alternative options.
                </p>
              `
              }
              
              <div style="background: linear-gradient(135deg, #FDE047 0%, #F59E0B 100%); display: inline-block; padding: 15px 30px; border-radius: 25px; text-decoration: none; color: #115E59; font-weight: bold; font-size: 16px;">
                ${isApproved ? "📋 View Order History" : "📞 Contact Pharmacy"}
              </div>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #666; font-size: 14px;">
            <p>This is an automated message from DoctorPortal Pharmacy System</p>
            ${
              !isApproved
                ? `<p>If you have questions, please contact ${pharmacyId.pharmacyName} directly.</p>`
                : ""
            }
          </div>
        </div>
      `,
    };

    await sendEmail(emailData);
  } catch (error) {
    console.error("Failed to send refill response email to patient:", error);
  }
};

export default RefillRequest;
