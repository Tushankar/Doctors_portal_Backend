import Patient from "../models/Patient.js";
import Pharmacy from "../models/Pharmacy.js";
import ApiError from "../utils/ApiError.js";
import sendEmail from "../utils/sendEmail.js";
import { fileUploadService } from "./fileUploadController.js";
import { prescriptionController } from "./prescriptionController.js";

// Get patient profile
export const getProfile = async (req, res) => {
  const patient = await Patient.findById(req.user.id)
    .select("-password")
    .populate("prescriptionHistory.prescriptionId")
    .populate("prescriptionHistory.fulfilledBy", "pharmacyName address");

  if (!patient) {
    throw new ApiError("Patient not found", 404);
  }

  res.status(200).json({
    success: true,
    data: patient,
  });
};

// Update patient profile
export const updateProfile = async (req, res) => {
  const {
    firstName,
    lastName,
    phone,
    dateOfBirth,
    gender,
    address,
    emergencyContact,
    notificationPreferences,
  } = req.body;

  const patient = await Patient.findById(req.user.id);

  if (!patient) {
    throw new ApiError("Patient not found", 404);
  }

  // Update basic info
  if (firstName) patient.firstName = firstName;
  if (lastName) patient.lastName = lastName;
  if (phone) patient.phone = phone;
  if (dateOfBirth) patient.dateOfBirth = dateOfBirth;
  if (gender) patient.gender = gender;
  if (address) patient.address = { ...patient.address, ...address };
  if (emergencyContact) patient.emergencyContact = emergencyContact;
  if (notificationPreferences) {
    patient.notificationPreferences = {
      ...patient.notificationPreferences,
      ...notificationPreferences,
    };
  }

  await patient.save();

  res.status(200).json({
    success: true,
    data: patient,
  });
};

// Update medical history
export const updateMedicalHistory = async (req, res) => {
  const { medicalHistory, allergies } = req.body;

  const patient = await Patient.findById(req.user.id);

  if (!patient) {
    throw new ApiError("Patient not found", 404);
  }

  if (medicalHistory) patient.medicalHistory = medicalHistory;
  if (allergies) patient.allergies = allergies;

  await patient.save();

  res.status(200).json({
    success: true,
    data: patient,
  });
};

// Add current medication
export const addCurrentMedication = async (req, res) => {
  const {
    name,
    dosage,
    frequency,
    startDate,
    endDate,
    prescriptionId,
    refillReminders,
  } = req.body;

  const patient = await Patient.findById(req.user.id);

  if (!patient) {
    throw new ApiError("Patient not found", 404);
  }

  patient.currentMedications.push({
    name,
    dosage,
    frequency,
    startDate,
    endDate,
    prescriptionId,
    refillReminders: {
      enabled: refillReminders?.enabled || false,
      frequency: refillReminders?.frequency,
      lastReminder: new Date(),
      nextReminder: refillReminders?.enabled
        ? new Date(Date.now() + refillReminders.frequency * 24 * 60 * 60 * 1000)
        : null,
    },
  });

  await patient.save();

  // Schedule refill reminder if enabled
  if (refillReminders?.enabled) {
    // TODO: Implement reminder scheduling logic
  }

  res.status(200).json({
    success: true,
    data: patient.currentMedications,
  });
};

// Remove current medication
export const removeCurrentMedication = async (req, res) => {
  const { medicationId } = req.params;

  const patient = await Patient.findById(req.user.id);

  if (!patient) {
    throw new ApiError("Patient not found", 404);
  }

  patient.currentMedications = patient.currentMedications.filter(
    (med) => med._id.toString() !== medicationId
  );

  await patient.save();

  res.status(200).json({
    success: true,
    data: patient.currentMedications,
  });
};

// Get prescription history
export const getPrescriptionHistory = async (req, res) => {
  const patient = await Patient.findById(req.user.id)
    .populate({
      path: "prescriptionHistory.prescriptionId",
      select:
        "uploadedAt status ocrData validationResults createdAt description",
    })
    .populate({
      path: "prescriptionHistory.fulfilledBy",
      select: "pharmacyName address phone email",
    });

  if (!patient) {
    throw new ApiError("Patient not found", 404);
  }

  // Map the data to use the actual prescription status instead of patient history status
  const prescriptionData = patient.prescriptionHistory.map((historyItem) => {
    return {
      ...historyItem.toObject(),
      // Override status with actual prescription status
      status: historyItem.prescriptionId?.status || historyItem.status,
    };
  });

  res.status(200).json({
    success: true,
    data: prescriptionData,
  });
};

// Get pharmacy consultations
export const getPharmacyConsultations = async (req, res) => {
  const patient = await Patient.findById(req.user.id).populate({
    path: "pharmacyConsultations.pharmacyId",
    select: "pharmacyName pharmacistName phone email",
  });

  if (!patient) {
    throw new ApiError("Patient not found", 404);
  }

  res.status(200).json({
    success: true,
    data: patient.pharmacyConsultations,
  });
};

// Schedule pharmacy consultation
export const scheduleConsultation = async (req, res) => {
  const { pharmacyId, scheduledAt, notes } = req.body;

  const patient = await Patient.findById(req.user.id);

  if (!patient) {
    throw new ApiError("Patient not found", 404);
  }

  // TODO: Generate WebRTC meeting link
  const meetingLink = "https://meet.example.com/123"; // Placeholder

  patient.pharmacyConsultations.push({
    pharmacyId,
    scheduledAt,
    notes,
    meetingLink,
  });

  await patient.save();

  // Send email notification
  try {
    await sendEmail({
      email: patient.email,
      subject: "Pharmacy Consultation Scheduled",
      message: `Your consultation is scheduled for ${new Date(
        scheduledAt
      ).toLocaleString()}. Join using: ${meetingLink}`,
    });
  } catch (error) {
    console.error("Failed to send consultation email:", error);
  }

  res.status(200).json({
    success: true,
    data: patient.pharmacyConsultations[
      patient.pharmacyConsultations.length - 1
    ],
  });
};

// Update consultation status
export const updateConsultationStatus = async (req, res) => {
  const { consultationId } = req.params;
  const { status } = req.body;

  const patient = await Patient.findById(req.user.id);

  if (!patient) {
    throw new ApiError("Patient not found", 404);
  }

  const consultation = patient.pharmacyConsultations.id(consultationId);
  if (!consultation) {
    throw new ApiError("Consultation not found", 404);
  }

  consultation.status = status;
  await patient.save();

  res.status(200).json({
    success: true,
    data: consultation,
  });
};

// Get chat history
export const getChatHistory = async (req, res) => {
  const patient = await Patient.findById(req.user.id).populate({
    path: "chatHistory.pharmacyId",
    select: "pharmacyName pharmacistName",
  });

  if (!patient) {
    throw new ApiError("Patient not found", 404);
  }

  res.status(200).json({
    success: true,
    data: patient.chatHistory,
  });
};

// Update chat unread count
export const updateChatUnreadCount = async (req, res) => {
  const { pharmacyId } = req.params;
  const { unreadCount } = req.body;

  const patient = await Patient.findById(req.user.id);

  if (!patient) {
    throw new ApiError("Patient not found", 404);
  }

  const chatHistory = patient.chatHistory.find(
    (chat) => chat.pharmacyId.toString() === pharmacyId
  );

  if (chatHistory) {
    chatHistory.unreadCount = unreadCount;
    chatHistory.lastMessageAt = new Date();
  } else {
    patient.chatHistory.push({
      pharmacyId,
      unreadCount,
      lastMessageAt: new Date(),
    });
  }

  await patient.save();

  res.status(200).json({
    success: true,
    data: patient.chatHistory,
  });
};

// Discover nearby pharmacies
export const discoverNearbyPharmacies = async (req, res, next) => {
  try {
    const { longitude, latitude, radius } = req.query;
    const nearby = await Pharmacy.findNearby(
      parseFloat(longitude),
      parseFloat(latitude),
      radius ? parseInt(radius) : undefined
    );
    res.status(200).json({ success: true, data: nearby });
  } catch (error) {
    next(error);
  }
};

// Upload prescription (delegate to prescription controller)
export const uploadPrescription = async (req, res, next) => {
  console.log("uploadPrescription called");
  console.log("req.file:", req.file);
  console.log("req.body:", req.body);
  try {
    // Ensure a file was uploaded
    if (!req.file) {
      throw new ApiError("No file uploaded", 400);
    }
    // Process uploaded file
    const processedFile = fileUploadService.processUploadedFile(req.file);
    // Create prescription
    const result = await prescriptionController.createPrescription({
      patientId: req.user.id,
      originalFile: processedFile,
      description: req.body.description,
      patientNotes: req.body.patientNotes,
    });
    // Add prescription to patient's history
    const patient = await Patient.findById(req.user.id);
    // Add to patient's prescription history with allowed enum status
    patient.prescriptionHistory.push({
      prescriptionId: result.data._id,
      uploadedAt: new Date(),
      status: "uploaded", // Use valid status from updated enum
    });
    await patient.save();
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

// Payment endpoints (stubs)
export const makePayment = async (req, res, next) => {
  // TODO: Integrate payment gateway
  res.status(200).json({ success: true, message: "Payment processed (stub)" });
};

export const getPaymentHistory = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.user.id);
    const payments = patient.paymentHistory || [];
    res.status(200).json({ success: true, data: payments });
  } catch (error) {
    next(error);
  }
};
