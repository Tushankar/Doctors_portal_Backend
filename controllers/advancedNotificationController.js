import AdvancedNotification from "../models/AdvancedNotification.js";
import { Order } from "../models/Order.js";
import { Prescription } from "../models/Prescription.js";
import Pharmacy from "../models/Pharmacy.js";
import Patient from "../models/Patient.js";
import transporter from "../config/email.js";

// Create a new notification
export const createNotification = async (req, res) => {
  try {
    const {
      title,
      message,
      type,
      priority = "medium",
      recipients,
      spatial,
      targeting,
      referenceData,
      scheduling,
      channels,
      content,
    } = req.body;

    // Validate required fields
    if (!title || !message || !type) {
      return res.status(400).json({
        success: false,
        message: "Title, message, and type are required",
      });
    }

    // Create notification
    const notification = new AdvancedNotification({
      title,
      message,
      type,
      priority,
      recipients: recipients || [],
      spatial: spatial || { enabled: false },
      targeting: targeting || {},
      referenceData: referenceData || {},
      scheduling: scheduling || {},
      channels: channels || { inApp: { enabled: true } },
      content: content || {},
      createdBy: {
        userId: req.user._id,
        userRole: req.user.role,
        isSystem: false,
      },
      status: scheduling?.scheduledFor ? "scheduled" : "active",
    });

    await notification.save();

    // If spatial targeting is enabled, find users in the area
    if (spatial?.enabled && spatial.targetLocation?.coordinates) {
      await addSpatialRecipients(notification);
    }

    // If role-based targeting is specified, add users by role
    if (targeting?.roles?.length > 0) {
      await addRoleBasedRecipients(notification);
    }

    // Process immediate delivery if not scheduled
    if (!scheduling?.scheduledFor) {
      await processNotificationDelivery(notification);
    }

    res.status(201).json({
      success: true,
      data: notification,
      message: "Notification created successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating notification",
      error: error.message,
    });
  }
};

// Get notifications for current user
export const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      type,
      priority,
      unreadOnly = false,
      limit = 50,
      page = 1,
      includeExpired = false,
    } = req.query;

    const options = {
      type: type || undefined,
      priority: priority || undefined,
      unreadOnly: unreadOnly === "true",
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit),
    };

    let query = {
      "recipients.userId": userId,
      status: "active",
    };

    if (!includeExpired) {
      query.$or = [
        { "scheduling.expiresAt": { $exists: false } },
        { "scheduling.expiresAt": { $gte: new Date() } },
      ];
    }

    if (options.unreadOnly) {
      query["recipients"] = {
        $elemMatch: {
          userId: userId,
          deliveryStatus: { $ne: "read" },
        },
      };
    }

    if (options.type) {
      query.type = options.type;
    }

    if (options.priority) {
      query.priority = options.priority;
    }

    const notifications = await AdvancedNotification.find(query)
      .sort({ priority: -1, createdAt: -1 })
      .limit(options.limit)
      .skip(options.skip)
      .populate("referenceData.referenceId")
      .populate("createdBy.userId", "firstName lastName");

    // Filter recipient data to show only current user's status
    const userNotifications = notifications.map((notification) => {
      const userRecipient = notification.recipients.find(
        (r) => r.userId.toString() === userId.toString()
      );

      const notificationObj = notification.toObject();

      // For admin users, use the global read field; for others, use recipient status
      let readStatus;
      if (req.user.role === "admin") {
        readStatus = notification.read || false;
      } else {
        readStatus = userRecipient?.deliveryStatus === "read" || false;
      }

      return {
        ...notificationObj,
        userStatus: userRecipient || { deliveryStatus: "pending" },
        read: readStatus,
        recipients: undefined, // Remove other recipients for privacy
      };
    });

    const totalCount = await AdvancedNotification.countDocuments(query);

    res.json({
      success: true,
      data: userNotifications,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalCount / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching notifications",
      error: error.message,
    });
  }
};

// Mark notification as read
export const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    const notification = await AdvancedNotification.findById(notificationId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    // For admin users, mark the notification as globally read
    if (userRole === "admin") {
      notification.read = true;
      const savedNotification = await notification.save();
      console.log(
        `Admin marked notification ${notificationId} as read. Saved read status: ${savedNotification.read}`
      );
    } else {
      // For regular users, mark their specific recipient status
      await notification.markAsRead(userId);
    }

    res.json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error marking notification as read",
      error: error.message,
    });
  }
};

// Track notification action
export const trackNotificationAction = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { action } = req.body;
    const userId = req.user._id;

    const notification = await AdvancedNotification.findById(notificationId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    await notification.trackAction(userId, action);

    res.json({
      success: true,
      message: "Action tracked successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error tracking action",
      error: error.message,
    });
  }
};

// Get notifications by location (spatial feature)
export const getNotificationsByLocation = async (req, res) => {
  try {
    const { longitude, latitude, radius = 5000 } = req.query;

    if (!longitude || !latitude) {
      return res.status(400).json({
        success: false,
        message: "Longitude and latitude are required",
      });
    }

    const notifications = await AdvancedNotification.findByLocation(
      parseFloat(longitude),
      parseFloat(latitude),
      parseInt(radius)
    );

    const userNotifications = notifications.filter((notification) => {
      return notification.recipients.some(
        (r) => r.userId.toString() === req.user._id.toString()
      );
    });

    res.json({
      success: true,
      data: userNotifications,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching location-based notifications",
      error: error.message,
    });
  }
};

// Get notification analytics (admin only)
export const getNotificationAnalytics = async (req, res) => {
  try {
    const analytics = await AdvancedNotification.aggregate([
      {
        $group: {
          _id: "$type",
          total: { $sum: 1 },
          totalImpressions: { $sum: "$analytics.impressions" },
          totalClicks: { $sum: "$analytics.clicks" },
          avgEngagement: { $avg: "$analytics.engagement" },
        },
      },
      {
        $project: {
          type: "$_id",
          total: 1,
          totalImpressions: 1,
          totalClicks: 1,
          avgEngagement: 1,
          clickRate: {
            $cond: [
              { $gt: ["$totalImpressions", 0] },
              {
                $multiply: [
                  { $divide: ["$totalClicks", "$totalImpressions"] },
                  100,
                ],
              },
              0,
            ],
          },
        },
      },
    ]);

    const recentActivity = await AdvancedNotification.find({
      status: "active",
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("title type priority createdAt analytics");

    res.json({
      success: true,
      data: {
        typeAnalytics: analytics,
        recentActivity,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching analytics",
      error: error.message,
    });
  }
};

// System notification creators for different events
export const createOrderStatusNotification = async (
  order,
  newStatus,
  notes = ""
) => {
  try {
    const priorityMap = {
      processing: "medium",
      confirmed: "medium",
      preparing: "medium",
      ready: "high",
      dispatched: "high",
      delivered: "high",
      cancelled: "urgent",
    };

    const notification = new AdvancedNotification({
      title: `Order ${order.orderNumber} - ${newStatus
        .replace("_", " ")
        .toUpperCase()}`,
      message: `Your order status has been updated to ${newStatus.replace(
        "_",
        " "
      )}. ${notes}`.trim(),
      type: "order_status",
      priority: priorityMap[newStatus] || "medium",
      recipients: [
        {
          userId: order.patientId,
          userRole: "patient",
          deliveryStatus: "pending",
        },
      ],
      referenceData: {
        referenceId: order._id,
        referenceType: "order",
        metadata: {
          orderNumber: order.orderNumber,
          status: newStatus,
          notes,
          pharmacyName: order.pharmacyId?.pharmacyName,
        },
      },
      channels: {
        inApp: { enabled: true },
        email: { enabled: true },
        sms: { enabled: newStatus === "ready" || newStatus === "delivered" },
      },
      content: {
        actionButton: {
          text: "View Order",
          action: "navigate",
          url: `/orders/${order._id}`,
        },
      },
      createdBy: {
        isSystem: true,
      },
    });

    await notification.save();
    await processNotificationDelivery(notification);

    return notification;
  } catch (error) {
    throw error;
  }
};

export const createNearbyPharmacyNotification = async (
  patientId,
  patientLocation,
  nearbyPharmacies
) => {
  try {
    if (!nearbyPharmacies || nearbyPharmacies.length === 0) return;

    const notification = new AdvancedNotification({
      title: "Pharmacies Near You",
      message: `Found ${nearbyPharmacies.length} pharmacies within 5km of your location. Check them out for quick prescription fulfillment!`,
      type: "pharmacy_nearby",
      priority: "low",
      recipients: [
        {
          userId: patientId,
          userRole: "patient",
          deliveryStatus: "pending",
        },
      ],
      spatial: {
        enabled: true,
        targetLocation: {
          type: "Point",
          coordinates: [patientLocation.longitude, patientLocation.latitude],
        },
        radius: 5000,
      },
      referenceData: {
        referenceType: "pharmacy",
        metadata: {
          pharmacyCount: nearbyPharmacies.length,
          pharmacies: nearbyPharmacies.map((p) => ({
            id: p._id,
            name: p.pharmacyName,
            distance: p.distance,
          })),
        },
      },
      content: {
        actionButton: {
          text: "View Pharmacies",
          action: "navigate",
          url: "/pharmacies/nearby",
        },
      },
      scheduling: {
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expire in 24 hours
      },
      createdBy: {
        isSystem: true,
      },
    });

    await notification.save();
    await processNotificationDelivery(notification);

    return notification;
  } catch (error) {
    throw error;
  }
};

// Helper functions
async function addSpatialRecipients(notification) {
  try {
    // Find users within the spatial area
    const { coordinates } = notification.spatial.targetLocation;
    const radius = notification.spatial.radius || 50000000;

    // This would need user location data - implement based on your user schema
  } catch (error) {
    // Error adding spatial recipients
  }
}

async function addRoleBasedRecipients(notification) {
  try {
    const { roles } = notification.targeting;

    // Find users by roles
    for (const role of roles) {
      let users = [];

      if (role === "patient") {
        users = await Patient.find({}).select("_id");
      } else if (role === "pharmacy") {
        users = await Pharmacy.find({}).select("_id");
      }
      // Add other role queries as needed

      users.forEach((user) => {
        notification.recipients.push({
          userId: user._id,
          userRole: role,
          deliveryStatus: "pending",
        });
      });
    }

    await notification.save();
  } catch (error) {
    // Error adding role-based recipients
  }
}

export async function processNotificationDelivery(notification) {
  try {
    // Process different delivery channels
    if (notification.channels.email?.enabled) {
      await sendEmailNotifications(notification);
    }

    if (notification.channels.sms?.enabled) {
      await sendSMSNotifications(notification);
    }

    // Mark in-app notifications as delivered
    if (notification.channels.inApp?.enabled) {
      notification.channels.inApp.delivered = true;
      notification.recipients.forEach((recipient) => {
        if (recipient.deliveryStatus === "pending") {
          recipient.deliveryStatus = "delivered";
          recipient.deliveredAt = new Date();
        }
      });
      await notification.save();
    }
  } catch (error) {
    // Error processing notification delivery
  }
}

async function sendEmailNotifications(notification) {
  try {
    // Import email transporter
    const { default: transporter } = await import("../config/email.js");
    const { default: User } = await import("../models/User.js");

    // Get recipients who have email enabled
    for (const recipient of notification.recipients) {
      try {
        // Get user details
        const user = await User.findById(recipient.userId).select(
          "email firstName lastName"
        );
        if (!user || !user.email) continue;

        // Determine email content based on notification type
        const emailContent = generateEmailContent(notification, user);

        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: user.email,
          subject: emailContent.subject,
          html: emailContent.html,
        };

        const result = await transporter.sendMail(mailOptions);
        console.log(`📧 Email sent to ${user.email}:`, result.messageId);

        // Update delivery status
        recipient.deliveryStatus = "delivered";
        recipient.deliveredAt = new Date();
      } catch (emailError) {
        console.error(
          `📧 Failed to send email to recipient ${recipient.userId}:`,
          emailError
        );
        recipient.deliveryStatus = "failed";
      }
    }

    await notification.save();
  } catch (error) {
    console.error("📧 Error in sendEmailNotifications:", error);
  }
}

function generateEmailContent(notification, user) {
  // Color mapping for different notification types
  const typeColors = {
    order_status: "#3B82F6", // Blue
    new_order: "#10B981", // Green
    approval: "#8B5CF6", // Purple
    system_alert: "#F59E0B", // Amber
    appointment: "#6366F1", // Indigo
  };

  const color = typeColors[notification.type] || "#6366F1";

  // Generate action button HTML if available
  let actionButtonHtml = "";
  if (notification.content?.actionButton) {
    const button = notification.content.actionButton;
    actionButtonHtml = `
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL}${button.url}" 
           style="background: ${color}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          ${button.text}
        </a>
      </div>
    `;
  }

  // Generate reference data HTML if available
  let referenceDataHtml = "";
  if (notification.referenceData?.metadata) {
    const metadata = notification.referenceData.metadata;
    referenceDataHtml = `
      <div class="reference-info">
        <h3>Details:</h3>
        ${
          metadata.orderNumber
            ? `<p><strong>Order Number:</strong> ${metadata.orderNumber}</p>`
            : ""
        }
        ${
          metadata.status
            ? `<p><strong>Status:</strong> <span style="color: ${color}; font-weight: bold; text-transform: uppercase;">${metadata.status.replace(
                "_",
                " "
              )}</span></p>`
            : ""
        }
        ${
          metadata.pharmacyName
            ? `<p><strong>Pharmacy:</strong> ${metadata.pharmacyName}</p>`
            : ""
        }
        ${
          metadata.notes
            ? `<p><strong>Notes:</strong> ${metadata.notes}</p>`
            : ""
        }
        ${
          metadata.patientName
            ? `<p><strong>Patient:</strong> ${metadata.patientName}</p>`
            : ""
        }
      </div>
    `;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${color}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .reference-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${color}; }
        .priority-badge { display: inline-block; background: ${color}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .notification-meta { background: #f0f0f0; padding: 15px; border-radius: 6px; margin: 15px 0; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${notification.title}</h1>
          <span class="priority-badge">${notification.priority}</span>
        </div>
        <div class="content">
          <p>Dear ${user.firstName || "User"} ${user.lastName || ""},</p>
          
          <p>${notification.message}</p>
          
          ${referenceDataHtml}
          
          ${actionButtonHtml}
          
          <div class="notification-meta">
            <p><strong>Notification Type:</strong> ${notification.type
              .replace("_", " ")
              .toUpperCase()}</p>
            <p><strong>Sent:</strong> ${notification.createdAt.toLocaleString()}</p>
          </div>
          
          <p>You can view and manage all your notifications by logging into your account on our platform.</p>
          
          <p>If you have any questions, please don't hesitate to contact us.</p>
          
          <p>Best regards,<br>The Medical Portal Team</p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return {
    subject: `${notification.title} - Medical Portal`,
    html: html,
  };
}

async function sendSMSNotifications(notification) {
  // Implement SMS sending logic
}

// New Order Workflow Notifications

// 1. When patient creates order - notify pharmacy
export const createNewOrderNotification = async (order) => {
  try {
    // Get pharmacy user ID
    const pharmacy = await Pharmacy.findById(order.pharmacyId).populate(
      "userId"
    );
    if (!pharmacy || !pharmacy.userId) {
      return;
    }

    const notification = new AdvancedNotification({
      title: `New Order Received! 📦`,
      message: `New order ${order.orderNumber} from ${order.patientId?.firstName} ${order.patientId?.lastName}. Please review and approve the prescription.`,
      type: "new_order",
      priority: "high",
      recipients: [
        {
          userId: pharmacy.userId._id,
          userRole: "pharmacy",
          deliveryStatus: "pending",
        },
      ],
      referenceData: {
        referenceId: order._id,
        referenceType: "order",
        metadata: {
          orderNumber: order.orderNumber,
          patientName: `${order.patientId?.firstName} ${order.patientId?.lastName}`,
          patientEmail: order.patientId?.email,
          status: "new_order",
          pharmacyName: pharmacy.pharmacyName,
        },
      },
      channels: {
        inApp: { enabled: true },
        email: { enabled: true },
      },
      content: {
        actionButton: {
          text: "View Order",
          action: "navigate",
          url: `/pharmacy/orders/${order._id}`,
        },
        tags: ["new_order", "pharmacy", "urgent"],
      },
      createdBy: {
        userId: order.patientId._id,
        userRole: "patient",
        isSystem: false,
      },
      status: "active",
    });

    await notification.save();
    await processNotificationDelivery(notification);

    return notification;
  } catch (error) {
    throw error;
  }
};

// 2. When pharmacy approves prescription - notify patient
export const createPrescriptionApprovalNotification = async (
  patientId,
  prescriptionId,
  pharmacyId
) => {
  try {
    // Fetch the required data
    const prescription = await Prescription.findById(prescriptionId);
    const pharmacy = await Pharmacy.findById(pharmacyId).populate("userId");

    if (!prescription || !pharmacy) {
      throw new Error("Prescription or Pharmacy not found");
    }

    const notification = new AdvancedNotification({
      title: `Prescription Approved! ✅`,
      message: `Your prescription has been approved by ${pharmacy.pharmacyName}. You can now proceed with the order.`,
      type: "approval",
      priority: "high",
      recipients: [
        {
          userId: patientId,
          userRole: "patient",
          deliveryStatus: "pending",
        },
      ],
      referenceData: {
        referenceId: prescriptionId,
        referenceType: "prescription",
        metadata: {
          prescriptionId: prescriptionId,
          pharmacyId: pharmacyId,
          pharmacyName: pharmacy.pharmacyName,
          status: "approved",
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
          url: `/prescriptions/${prescriptionId}`,
        },
        tags: ["prescription", "approved", "patient"],
      },
      scheduling: {
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
      createdBy: {
        userId: pharmacy.userId._id,
        userRole: "pharmacy",
        isSystem: false,
      },
      status: "active",
    });

    await notification.save();
    await processNotificationDelivery(notification);

    return notification;
  } catch (error) {
    throw error;
  }
};

// 3. Enhanced getUserNotifications with admin visibility
// Enhanced getUserNotifications with admin visibility - works both as API endpoint and helper function
export const getUserNotificationsWithAdminAccess = async (req, res) => {
  try {
    // Handle both API calls (req, res) and direct function calls (userId string)
    let userId,
      userRole,
      queryParams = {};

    if (typeof req === "string") {
      // Direct function call with userId
      userId = req;
      // Get user role from database
      const { default: User } = await import("../models/User.js");
      const user = await User.findById(userId);
      userRole = user?.role || "patient";
      // res is actually query params in this case
      queryParams = res || {};
    } else {
      // API endpoint call
      userId = req.user._id;
      userRole = req.user.role;
      queryParams = req.query || {};
    }

    const {
      type,
      priority,
      unreadOnly = false,
      page = 1,
      limit = 50,
      includeExpired = false,
    } = queryParams;

    let query = { status: "active" };

    // Admin can see ALL notifications
    if (userRole === "admin") {
      // Admin sees everything, no user filtering
    } else {
      // Regular users only see their own notifications
      query["recipients.userId"] = userId;
    }

    // Apply filters
    if (type) query.type = type;
    if (priority) query.priority = priority;
    if (unreadOnly === "true") {
      query["recipients.deliveryStatus"] = { $ne: "read" };
    }
    if (!includeExpired) {
      query.$or = [
        { "scheduling.expiresAt": { $exists: false } },
        { "scheduling.expiresAt": null },
        { "scheduling.expiresAt": { $gt: new Date() } },
      ];
    }

    const skip = (page - 1) * limit;

    const notifications = await AdvancedNotification.find(query)
      .populate("recipients.userId", "username role firstName lastName")
      .populate("createdBy.userId", "username role firstName lastName")
      .sort({ priority: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await AdvancedNotification.countDocuments(query);

    // Process notifications for display
    const processedNotifications = notifications.map((notification) => {
      const notificationObj = notification.toObject();

      if (userRole !== "admin") {
        // For regular users, find their specific recipient data
        const userRecipient = notification.recipients.find(
          (r) => r.userId._id.toString() === userId.toString()
        );
        notificationObj.userStatus = userRecipient || {
          deliveryStatus: "pending",
        };
        // Remove other recipients for privacy
        notificationObj.recipients = undefined;
      } else {
        // For admin, show aggregated status
        notificationObj.adminView = {
          totalRecipients: notification.recipients.length,
          readCount: notification.recipients.filter(
            (r) => r.deliveryStatus === "read"
          ).length,
          unreadCount: notification.recipients.filter(
            (r) => r.deliveryStatus === "pending"
          ).length,
        };
      }

      return notificationObj;
    });

    const result = {
      success: true,
      data: processedNotifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
      userRole,
      isAdmin: userRole === "admin",
    };

    // Return response for API calls, return data for direct calls
    if (typeof req === "string") {
      return result;
    } else {
      return res.status(200).json(result);
    }
  } catch (error) {
    if (typeof req === "string") {
      throw error;
    } else {
      return res.status(500).json({
        success: false,
        message: "Error retrieving notifications",
        error: error.message,
      });
    }
  }
};

// 4. When pharmacy declines prescription - notify patient
export const createPrescriptionDeclineNotification = async (
  patientId,
  prescriptionId,
  pharmacyId,
  reason = ""
) => {
  try {
    // Fetch the required data
    const prescription = await Prescription.findById(prescriptionId);
    const pharmacy = await Pharmacy.findById(pharmacyId).populate("userId");

    if (!prescription || !pharmacy) {
      throw new Error("Prescription or Pharmacy not found");
    }

    const notification = new AdvancedNotification({
      title: `Prescription Declined ❌`,
      message: `Your prescription has been declined by ${
        pharmacy.pharmacyName
      }. ${
        reason
          ? `Reason: ${reason}`
          : "Please contact the pharmacy for more information."
      }`,
      type: "approval",
      priority: "high",
      recipients: [
        {
          userId: patientId,
          userRole: "patient",
          deliveryStatus: "pending",
        },
      ],
      referenceData: {
        referenceId: prescriptionId,
        referenceType: "prescription",
        metadata: {
          prescriptionId: prescriptionId,
          pharmacyId: pharmacyId,
          pharmacyName: pharmacy.pharmacyName,
          status: "declined",
          reason: reason,
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
          url: `/prescriptions/${prescriptionId}`,
        },
        tags: ["prescription", "declined", "patient"],
      },
      scheduling: {
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
      createdBy: {
        userId: pharmacy.userId._id,
        userRole: "pharmacy",
        isSystem: false,
      },
      status: "active",
    });

    await notification.save();
    await processNotificationDelivery(notification);

    return notification;
  } catch (error) {
    throw error;
  }
};
