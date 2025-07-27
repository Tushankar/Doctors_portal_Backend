import mongoose from "mongoose";
import User from "./User.js";

const patientSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, "Please provide first name"],
  },
  lastName: {
    type: String,
    required: [true, "Please provide last name"],
  },
  phone: {
    type: String,
    required: [true, "Please provide phone number"],
    match: [/^[0-9]{10}$/, "Please provide a valid 10-digit phone number"],
  },
  dateOfBirth: {
    type: Date,
    required: true,
  },
  gender: {
    type: String,
    enum: ["male", "female", "other"],
    required: true,
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] },
    },
    country: {
      type: String,
      default: "India",
    },
  },
  medicalHistory: [
    {
      condition: String,
      diagnosedDate: Date,
      status: {
        type: String,
        enum: ["active", "resolved"],
        default: "active",
      },
      notes: String,
      attachments: [String], // URLs to medical documents
    },
  ],
  allergies: [String],
  currentMedications: [
    {
      name: String,
      dosage: String,
      frequency: String,
      startDate: Date,
      endDate: Date,
      prescriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Prescription",
      },
      refillReminders: {
        enabled: { type: Boolean, default: false },
        frequency: { type: Number }, // days
        lastReminder: Date,
        nextReminder: Date,
      },
    },
  ],
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String,
  },
  profilePicture: String,
  prescriptionHistory: [
    {
      prescriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Prescription",
      },
      uploadedAt: Date,
      status: {
        type: String,
        enum: [
          "pending",
          "accepted",
          "preparing",
          "dispatched",
          "delivered",
          "cancelled",
        ],
        default: "pending",
      },
      fulfilledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Pharmacy",
      },
      paymentStatus: {
        status: {
          type: String,
          enum: ["pending", "completed", "failed"],
          default: "pending",
        },
        amount: Number,
        transactionId: String,
        paidAt: Date,
      },
    },
  ],
  pharmacyConsultations: [
    {
      pharmacyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Pharmacy",
      },
      scheduledAt: Date,
      status: {
        type: String,
        enum: ["scheduled", "completed", "cancelled"],
        default: "scheduled",
      },
      meetingLink: String,
      notes: String,
    },
  ],
  chatHistory: [
    {
      pharmacyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Pharmacy",
      },
      lastMessageAt: Date,
      unreadCount: { type: Number, default: 0 },
    },
  ],
  notificationPreferences: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
  },
});

const Patient = User.discriminator("patient", patientSchema);
export default Patient;
