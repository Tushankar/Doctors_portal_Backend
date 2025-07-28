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
      condition: {
        type: String,
        required: true,
      },
      diagnosedDate: {
        type: Date,
        required: true,
      },
      status: {
        type: String,
        enum: ["active", "resolved", "monitoring"],
        default: "active",
      },
      doctor: String,
      notes: String,
      attachments: [String], // URLs to medical documents
      createdAt: {
        type: Date,
        default: Date.now,
      },
      updatedAt: {
        type: Date,
        default: Date.now,
      },
      sharedWithPharmacies: [
        {
          pharmacyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Pharmacy",
          },
          sharedAt: {
            type: Date,
            default: Date.now,
          },
          approvalStatus: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending",
          },
        },
      ],
    },
  ],
  allergies: [
    {
      allergen: {
        type: String,
        required: true,
      },
      severity: {
        type: String,
        enum: ["mild", "moderate", "severe"],
        default: "moderate",
      },
      reaction: String,
      notes: String,
      addedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  chronicConditions: [
    {
      condition: String,
      diagnosedDate: Date,
      managementPlan: String,
      medications: [String],
      notes: String,
    },
  ],
  vitalSigns: [
    {
      bloodPressure: {
        systolic: Number,
        diastolic: Number,
      },
      heartRate: Number,
      temperature: Number,
      weight: Number,
      height: Number,
      oxygenSaturation: Number,
      recordedAt: {
        type: Date,
        default: Date.now,
      },
      recordedBy: String, // doctor, nurse, self-reported
      notes: String,
    },
  ],
  labResults: [
    {
      testName: String,
      testDate: Date,
      results: [
        {
          parameter: String,
          value: String,
          unit: String,
          referenceRange: String,
          status: {
            type: String,
            enum: ["normal", "abnormal", "critical"],
          },
        },
      ],
      orderedBy: String,
      labName: String,
      attachments: [String],
    },
  ],
  insuranceInfo: {
    provider: String,
    policyNumber: String,
    groupNumber: String,
    coverageType: String,
    validUntil: Date,
    copayAmount: Number,
  },
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
