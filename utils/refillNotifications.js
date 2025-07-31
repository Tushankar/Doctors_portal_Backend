import AdvancedNotification from "../models/AdvancedNotification.js";
import { processNotificationDelivery } from "../controllers/advancedNotificationController.js";

// Utility function for creating refill response notifications
export const createRefillResponseNotification = async (
  refillRequest,
  status,
  message
) => {
  try {
    const isApproved = status === "approved";

    const notificationTitle = isApproved
      ? "Refill Request Approved"
      : "Refill Request Declined";

    const notificationMessage = isApproved
      ? `Your refill request has been approved by ${refillRequest.pharmacyId.pharmacyName}. You can proceed with the refill.`
      : `Your refill request has been declined by ${
          refillRequest.pharmacyId.pharmacyName
        }. ${message || "Please contact the pharmacy for more details."}`;

    const notification = new AdvancedNotification({
      title: notificationTitle,
      message: notificationMessage,
      type: "refill_response",
      priority: "high",
      recipients: [
        {
          userId: refillRequest.patientId._id,
          userRole: "patient",
          deliveryStatus: "pending",
        },
      ],
      referenceData: {
        referenceId: refillRequest._id,
        referenceType: "refill_request",
        metadata: {
          refillRequestId: refillRequest._id,
          pharmacyName: refillRequest.pharmacyId.pharmacyName,
          status: status,
          response: message,
          orderNumber: refillRequest.originalOrderId._id,
        },
      },
      channels: {
        inApp: { enabled: true },
        email: { enabled: true },
      },
      content: {
        actionButton: isApproved
          ? {
              text: "View Order History",
              action: "navigate",
              url: "/patient/orders",
            }
          : undefined,
        tags: ["refill_response", status, "patient"],
      },
      createdBy: {
        userId: refillRequest.pharmacyId.userId || refillRequest.pharmacyId._id,
        userRole: "pharmacy",
        isSystem: false,
      },
      status: "active",
    });

    await notification.save();
    await processNotificationDelivery(notification);

    return notification;
  } catch (error) {
    console.error("❌ Error creating refill response notification:", error);
    throw error;
  }
};

// Utility function for creating refill request notifications (for pharmacy)
export const createRefillRequestNotification = async (refillRequest) => {
  try {
    const notification = new AdvancedNotification({
      title: "New Refill Request",
      message: `${refillRequest.patientId.firstName} ${refillRequest.patientId.lastName} has requested a refill for order #${refillRequest.originalOrderId._id}`,
      type: "refill_request",
      priority: "medium",
      recipients: [
        {
          userId: refillRequest.pharmacyId._id,
          userRole: "pharmacy",
          deliveryStatus: "pending",
        },
      ],
      referenceData: {
        referenceId: refillRequest._id,
        referenceType: "refill_request",
        metadata: {
          refillRequestId: refillRequest._id,
          patientName: `${refillRequest.patientId.firstName} ${refillRequest.patientId.lastName}`,
          orderNumber: refillRequest.originalOrderId._id,
          medicationCount: refillRequest.medications?.length || 0,
        },
      },
      channels: {
        inApp: { enabled: true },
        email: { enabled: true },
      },
      content: {
        actionButton: {
          text: "Review Refill Request",
          action: "navigate",
          url: "/pharmacy/orders",
        },
        tags: ["refill_request", "pharmacy", "pending"],
      },
      createdBy: {
        userId: refillRequest.patientId._id,
        userRole: "patient",
        isSystem: false,
      },
      status: "active",
    });

    await notification.save();
    await processNotificationDelivery(notification);

    return notification;
  } catch (error) {
    console.error("❌ Error creating refill request notification:", error);
    throw error;
  }
};
