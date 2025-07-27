import mongoose from "mongoose";

const pharmacyApprovalSchema = new mongoose.Schema({
  pharmacyData: {
    email: {
      type: String,
      required: true,
    },
    typeOfPharmacy: {
      type: String,
      required: [true, "Type of pharmacy is required"],
      enum: [
        "retail",
        "hospital",
        "clinical",
        "compounding",
        "specialty",
        "online",
        "other",
      ],
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    pharmacyName: {
      type: String,
      required: true,
    },
    licenseNumber: {
      type: String,
      required: true,
    },
    pharmacistName: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: {
        type: String,
        default: "India",
      },
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    operatingHours: {
      monday: { open: String, close: String },
      tuesday: { open: String, close: String },
      wednesday: { open: String, close: String },
      thursday: { open: String, close: String },
      friday: { open: String, close: String },
      saturday: { open: String, close: String },
      sunday: { open: String, close: String },
    },
    services: [
      {
        type: String,
        enum: [
          "prescription_filling",
          "medication_therapy_management",
          "compounding",
          "vaccination",
          "home_delivery",
          "consultation",
          "other",
        ],
      },
    ],
    deliveryAvailable: {
      type: Boolean,
      default: false,
    },
    deliveryRadius: Number,
    verificationDocuments: [
      {
        documentType: String,
        documentUrl: String,
        cloudinaryPublicId: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  adminRemarks: String,
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  reviewedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const PharmacyApproval = mongoose.model(
  "PharmacyApproval",
  pharmacyApprovalSchema
);
export default PharmacyApproval;
