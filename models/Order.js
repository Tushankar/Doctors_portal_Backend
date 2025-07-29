import mongoose from "mongoose";

const { Schema } = mongoose;

const OrderItemSchema = new Schema({
  medicationName: { type: String, required: true },
  dosage: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  totalPrice: { type: Number, required: true, min: 0 },
  notes: { type: String },
});

const OrderSchema = new Schema(
  {
    prescriptionId: {
      type: Schema.Types.ObjectId,
      ref: "Prescription",
      required: true,
      index: true,
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    pharmacyId: {
      type: Schema.Types.ObjectId,
      ref: "Pharmacy",
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: [
        "placed", // Order just placed by patient
        "confirmed", // Pharmacy confirmed the order
        "preparing", // Pharmacy is preparing medications
        "ready", // Order ready for pickup/delivery
        "out_for_delivery", // For delivery orders
        "delivered", // Order completed
        "cancelled", // Order cancelled
        "on_hold", // Order on hold for some reason
      ],
      default: "placed",
      index: true,
    },
    orderType: {
      type: String,
      enum: ["pickup", "delivery"],
      required: true,
    },
    items: [OrderItemSchema],
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    // Delivery information
    deliveryInfo: {
      address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
      },
      phoneNumber: String,
      deliveryInstructions: String,
      estimatedDeliveryTime: Date,
      actualDeliveryTime: Date,
      deliveryFee: { type: Number, default: 0 },
    },
    // Pickup information
    pickupInfo: {
      estimatedPickupTime: Date,
      actualPickupTime: Date,
      pickupInstructions: String,
    },
    // Payment information
    paymentInfo: {
      method: {
        type: String,
        enum: ["cash", "card", "insurance", "online"],
        required: true,
      },
      status: {
        type: String,
        enum: ["pending", "completed", "failed", "refunded"],
        default: "pending",
      },
      transactionId: String,
      paidAmount: { type: Number, default: 0 },
      insuranceCovered: { type: Number, default: 0 },
      copayAmount: { type: Number, default: 0 },
    },
    // Status tracking
    statusHistory: [
      {
        status: {
          type: String,
          enum: [
            "placed",
            "confirmed",
            "preparing",
            "ready",
            "out_for_delivery",
            "delivered",
            "cancelled",
            "on_hold",
          ],
          required: true,
        },
        timestamp: { type: Date, default: Date.now },
        updatedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        notes: String,
      },
    ],
    // Additional fields
    pharmacyNotes: String,
    patientNotes: String,
    specialInstructions: String,
    isUrgent: { type: Boolean, default: false },
    prescriptionVerified: { type: Boolean, default: false },

    // Timestamps for various stages
    placedAt: { type: Date, default: Date.now },
    confirmedAt: Date,
    preparedAt: Date,
    readyAt: Date,
    deliveredAt: Date,
    cancelledAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
OrderSchema.index({ prescriptionId: 1 });
OrderSchema.index({ patientId: 1, createdAt: -1 });
OrderSchema.index({ pharmacyId: 1, status: 1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ orderNumber: 1 });

// Pre-save middleware to generate order number
OrderSchema.pre("save", async function (next) {
  if (this.isNew && !this.orderNumber) {
    let orderNumber;
    let exists = true;
    let attempts = 0;

    while (exists && attempts < 5) {
      const count = await this.constructor.countDocuments();
      orderNumber = `ORD${Date.now()}${String(count + 1).padStart(4, "0")}`;
      exists = await this.constructor.exists({ orderNumber });
      attempts++;
    }

    if (exists) {
      return next(new Error("Failed to generate unique order number"));
    }

    this.orderNumber = orderNumber;
  }
  next();
});

export const Order = mongoose.model("Order", OrderSchema);
