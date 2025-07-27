import mongoose from "mongoose";

const { Schema } = mongoose;

const MedicationSchema = new Schema({
  name: { type: String, required: true },
  dosage: { type: String, required: true },
  frequency: { type: String, required: true },
  duration: { type: String },
  instructions: { type: String },
  confidence: { type: Number, required: true, min: 0, max: 1 },
});

const OCRResultSchema = new Schema({
  extractedText: { type: String, default: "" },
  medications: [MedicationSchema],
  confidence: { type: Number, required: true, min: 0, max: 1 },
  processingStatus: {
    type: String,
    enum: ["pending", "processing", "completed", "failed"],
    default: "pending",
  },
  processingError: { type: String },
  processedAt: { type: Date },
});

const ValidationFlagSchema = new Schema({
  type: {
    type: String,
    enum: [
      "drug_interaction",
      "dosage_error",
      "authenticity_concern",
      "unclear_text",
      "missing_info",
    ],
    required: true,
  },
  severity: {
    type: String,
    enum: ["low", "medium", "high", "critical"],
    required: true,
  },
  message: { type: String, required: true },
  confidence: { type: Number, required: true, min: 0, max: 1 },
});

const ValidationResultSchema = new Schema({
  isValid: { type: Boolean, required: true },
  flags: [ValidationFlagSchema],
  aiConfidence: { type: Number, required: true, min: 0, max: 1 },
  reviewRequired: { type: Boolean, required: true },
  validatedAt: { type: Date },
});

const FileInfoSchema = new Schema({
  publicId: { type: String, required: true },
  secureUrl: { type: String, required: true },
  originalName: { type: String, required: true },
  format: { type: String, required: true },
  bytes: { type: Number, required: true },
  width: { type: Number },
  height: { type: Number },
  resourceType: { type: String, required: true },
});

const FulfillmentInfoSchema = new Schema({
  pharmacyId: { type: Schema.Types.ObjectId, ref: "Pharmacy" },
  status: {
    type: String,
    enum: [
      "pending",
      "accepted",
      "preparing",
      "ready",
      "delivered",
      "cancelled",
    ],
    default: "pending",
  },
  estimatedCompletionTime: { type: Date },
  actualCompletionTime: { type: Date },
  notes: { type: String },
});

const PaymentInfoSchema = new Schema({
  amount: { type: Number },
  currency: { type: String, default: "USD" },
  status: {
    type: String,
    enum: ["pending", "completed", "failed", "refunded"],
    default: "pending",
  },
  transactionId: { type: String },
  paidAt: { type: Date },
});

const PrescriptionSchema = new Schema(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    pharmacyId: {
      type: Schema.Types.ObjectId,
      ref: "Pharmacy",
      index: true,
    },
    originalFile: {
      type: FileInfoSchema,
      required: true,
    },
    ocrData: {
      type: OCRResultSchema,
    },
    validationResults: {
      type: ValidationResultSchema,
    },
    status: {
      type: String,
      enum: [
        "uploaded",
        "processing",
        "pending_approval",
        "processed",
        "accepted",
        "preparing",
        "ready",
        "delivered",
        "cancelled",
      ],
      default: "uploaded",
      index: true,
    },
    description: {
      type: String,
      maxlength: 500,
    },
    patientNotes: {
      type: String,
      maxlength: 1000,
    },
    fulfillmentDetails: {
      type: FulfillmentInfoSchema,
    },
    paymentInfo: {
      type: PaymentInfoSchema,
    },
    // Track pharmacy approval requests before final selection
    approvalRequests: [
      {
        pharmacyId: { type: Schema.Types.ObjectId, ref: "Pharmacy" },
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
        requestedAt: { type: Date, default: Date.now },
        respondedAt: Date,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
PrescriptionSchema.index({ patientId: 1, createdAt: -1 });
PrescriptionSchema.index({ pharmacyId: 1, status: 1 });
PrescriptionSchema.index({ status: 1, createdAt: -1 });
PrescriptionSchema.index({ "ocrData.processingStatus": 1 });

export const Prescription = mongoose.model("Prescription", PrescriptionSchema);
