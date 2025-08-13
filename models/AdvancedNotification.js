import mongoose from "mongoose";
const { Schema } = mongoose;

// Enhanced notification schema with spatial and advanced features
const AdvancedNotificationSchema = new Schema(
  {
    // Core notification data
    title: {
      type: String,
      required: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    type: {
      type: String,
      enum: [
        "chat",
        "approval",
        "order_status",
        "new_order",
        "pharmacy_nearby",
        "emergency",
        "appointment",
        "prescription_ready",
        "delivery_update",
        "payment_reminder",
        "system_alert",
        "promotional",
        "security_alert",
      ],
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent", "critical"],
      default: "medium",
      index: true,
    },

    // Recipients and targeting
    recipients: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        userRole: {
          type: String,
          enum: ["patient", "pharmacy", "admin", "doctor"],
          required: true,
        },
        deliveryStatus: {
          type: String,
          enum: ["pending", "delivered", "read", "failed"],
          default: "pending",
        },
        deliveredAt: Date,
        readAt: Date,
        actionTaken: {
          type: String,
          enum: [
            "none",
            "clicked",
            "dismissed",
            "approved",
            "rejected",
            "responded",
          ],
          default: "none",
        },
        actionAt: Date,
      },
    ],

    // Spatial targeting features
    spatial: {
      enabled: {
        type: Boolean,
        default: false,
      },
      targetLocation: {
        type: {
          type: String,
          enum: ["Point"],
        },
        coordinates: {
          type: [Number], // [longitude, latitude]
          validate: {
            validator: function (v) {
              // Only validate if spatial is enabled
              if (this.spatial && this.spatial.enabled) {
                return (
                  Array.isArray(v) &&
                  v.length === 2 &&
                  typeof v[0] === "number" &&
                  typeof v[1] === "number"
                );
              }
              return true; // Allow undefined/null when spatial is disabled
            },
            message:
              "Coordinates must be an array of two numbers [longitude, latitude]",
          },
        },
      },
      radius: {
        type: Number, // in meters
        default: 5000,
      },
      locationName: String,
      city: String,
      state: String,
      zipCode: String,
    },

    // Targeting filters
    targeting: {
      roles: [
        {
          type: String,
          enum: ["patient", "pharmacy", "admin", "doctor"],
        },
      ],
      ageRange: {
        min: Number,
        max: Number,
      },
      conditions: [String], // medical conditions
      pharmacyTypes: [String], // chain, independent, hospital, etc.
      patientSegments: [String], // new, regular, premium, etc.
    },

    // Reference data
    referenceData: {
      referenceId: Schema.Types.ObjectId,
      referenceType: {
        type: String,
        enum: [
          "order",
          "prescription",
          "appointment",
          "pharmacy",
          "patient",
          "general",
        ],
      },
      metadata: Schema.Types.Mixed, // flexible data storage
    },

    // Scheduling and automation
    scheduling: {
      scheduledFor: Date,
      expiresAt: Date,
      recurring: {
        enabled: {
          type: Boolean,
          default: false,
        },
        frequency: {
          type: String,
          enum: ["daily", "weekly", "monthly", "custom"],
        },
        interval: Number, // for custom frequency in hours
        endDate: Date,
      },
    },

    // Delivery channels
    channels: {
      inApp: {
        enabled: {
          type: Boolean,
          default: true,
        },
        delivered: {
          type: Boolean,
          default: false,
        },
      },
      email: {
        enabled: {
          type: Boolean,
          default: false,
        },
        delivered: {
          type: Boolean,
          default: false,
        },
        emailId: String,
      },
      sms: {
        enabled: {
          type: Boolean,
          default: false,
        },
        delivered: {
          type: Boolean,
          default: false,
        },
        smsId: String,
      },
      push: {
        enabled: {
          type: Boolean,
          default: false,
        },
        delivered: {
          type: Boolean,
          default: false,
        },
        pushId: String,
      },
    },

    // Content and media
    content: {
      imageUrl: String,
      actionButton: {
        text: String,
        url: String,
        action: String, // navigate, approve, reject, etc.
      },
      links: [
        {
          text: String,
          url: String,
        },
      ],
      tags: [String],
    },

    // Analytics and tracking
    analytics: {
      impressions: {
        type: Number,
        default: 0,
      },
      clicks: {
        type: Number,
        default: 0,
      },
      conversions: {
        type: Number,
        default: 0,
      },
      engagement: {
        type: Number,
        default: 0, // calculated score
      },
    },

    // Status and lifecycle
    status: {
      type: String,
      enum: [
        "draft",
        "scheduled",
        "active",
        "paused",
        "completed",
        "cancelled",
        "expired",
      ],
      default: "active",
      index: true,
    },

    // Global read status (for admin view)
    read: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Creator information
    createdBy: {
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
      userRole: String,
      isSystem: {
        type: Boolean,
        default: false,
      },
    },

    // Performance tracking
    performance: {
      deliveryRate: Number,
      readRate: Number,
      actionRate: Number,
      lastCalculated: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
AdvancedNotificationSchema.index({
  "recipients.userId": 1,
  type: 1,
  status: 1,
});
AdvancedNotificationSchema.index({ "spatial.targetLocation": "2dsphere" });
AdvancedNotificationSchema.index({ priority: 1, createdAt: -1 });
AdvancedNotificationSchema.index({ "scheduling.scheduledFor": 1, status: 1 });
AdvancedNotificationSchema.index({ "scheduling.expiresAt": 1 });
AdvancedNotificationSchema.index({
  "referenceData.referenceId": 1,
  "referenceData.referenceType": 1,
});

// Virtual for read recipients
AdvancedNotificationSchema.virtual("readRecipients").get(function () {
  return this.recipients.filter((r) => r.deliveryStatus === "read");
});

// Virtual for unread recipients
AdvancedNotificationSchema.virtual("unreadRecipients").get(function () {
  return this.recipients.filter((r) => r.deliveryStatus !== "read");
});

// Method to mark as read for a user
AdvancedNotificationSchema.methods.markAsRead = function (userId) {
  const recipient = this.recipients.find(
    (r) => r.userId.toString() === userId.toString()
  );
  if (recipient) {
    recipient.deliveryStatus = "read";
    recipient.readAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to track action
AdvancedNotificationSchema.methods.trackAction = function (userId, action) {
  const recipient = this.recipients.find(
    (r) => r.userId.toString() === userId.toString()
  );
  if (recipient) {
    recipient.actionTaken = action;
    recipient.actionAt = new Date();
    this.analytics.clicks += 1;
    return this.save();
  }
  return Promise.resolve(this);
};

// Static method to find notifications by location
AdvancedNotificationSchema.statics.findByLocation = function (
  longitude,
  latitude,
  maxDistance = 5000
) {
  return this.find({
    "spatial.enabled": true,
    "spatial.targetLocation": {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
        $maxDistance: maxDistance,
      },
    },
    status: "active",
  });
};

// Static method to find notifications for user
AdvancedNotificationSchema.statics.findForUser = function (
  userId,
  options = {}
) {
  const query = {
    "recipients.userId": userId,
    status: "active",
  };

  if (options.unreadOnly) {
    query["recipients.deliveryStatus"] = { $ne: "read" };
  }

  if (options.type) {
    query.type = options.type;
  }

  if (options.priority) {
    query.priority = options.priority;
  }

  return this.find(query)
    .sort({ priority: -1, createdAt: -1 })
    .limit(options.limit || 50);
};

const AdvancedNotification = mongoose.model(
  "AdvancedNotification",
  AdvancedNotificationSchema
);

export default AdvancedNotification;
