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
      select: "_id pharmacyName address phone email contactInfo",
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

    // Validate coordinates
    const lng = parseFloat(longitude);
    const lat = parseFloat(latitude);

    if (isNaN(lng) || isNaN(lat)) {
      // If coordinates are not provided or invalid, return all pharmacies
      const allPharmacies = await Pharmacy.find({ isActive: true })
        .select(
          "pharmacyName address phone email location coordinates isActive"
        )
        .limit(20);

      return res.status(200).json({
        success: true,
        data: allPharmacies,
        message: "Showing all available pharmacies (location not provided)",
      });
    }

    // If coordinates are valid, find nearby pharmacies
    const nearby = await Pharmacy.findNearby(
      lng,
      lat,
      radius ? parseInt(radius) : undefined
    );

    res.status(200).json({ success: true, data: nearby });
  } catch (error) {
    console.error("Error in discoverNearbyPharmacies:", error);

    // Fallback: return all pharmacies if nearby search fails
    try {
      const allPharmacies = await Pharmacy.find({ isActive: true })
        .select(
          "pharmacyName address phone email location coordinates isActive"
        )
        .limit(20);

      res.status(200).json({
        success: true,
        data: allPharmacies,
        message: "Showing all available pharmacies (nearby search failed)",
      });
    } catch (fallbackError) {
      next(fallbackError);
    }
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

// Health Records Management
export const getHealthRecords = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.user.id).select(
      "medicalHistory allergies currentMedications vitalSigns emergencyContact insuranceInfo chronicConditions labResults"
    );

    if (!patient) {
      throw new ApiError("Patient not found", 404);
    }

    const healthRecords = {
      medicalHistory: patient.medicalHistory || [],
      allergies: patient.allergies || [],
      currentMedications: patient.currentMedications || [],
      vitalSigns: patient.vitalSigns || [],
      emergencyContact: patient.emergencyContact || {},
      insuranceInfo: patient.insuranceInfo || {},
      chronicConditions: patient.chronicConditions || [],
      labResults: patient.labResults || [],
    };

    res.status(200).json({
      success: true,
      data: healthRecords,
    });
  } catch (error) {
    next(error);
  }
};

export const addHealthRecord = async (req, res, next) => {
  try {
    const { type, ...recordData } = req.body;
    const patient = await Patient.findById(req.user.id);

    if (!patient) {
      throw new ApiError("Patient not found", 404);
    }

    let newRecord;

    switch (type) {
      case "medical-history":
        newRecord = {
          condition: recordData.condition,
          diagnosedDate: recordData.diagnosedDate,
          status: recordData.status || "active",
          doctor: recordData.doctor,
          notes: recordData.notes,
          attachments: recordData.attachments || [],
          createdAt: new Date(),
          updatedAt: new Date(),
          sharedWithPharmacies: [],
        };
        patient.medicalHistory.push(newRecord);
        break;

      case "medication":
        newRecord = {
          name: recordData.name,
          dosage: recordData.dosage,
          frequency: recordData.frequency,
          startDate: recordData.startDate,
          endDate: recordData.endDate,
          prescriptionId: recordData.prescriptionId,
          refillReminders: recordData.refillReminders || { enabled: false },
        };
        patient.currentMedications.push(newRecord);
        break;

      case "allergy":
        newRecord = {
          allergen: recordData.allergen,
          severity: recordData.severity || "moderate",
          reaction: recordData.reaction,
          notes: recordData.notes,
          addedAt: new Date(),
        };
        patient.allergies.push(newRecord);
        break;

      case "vital-signs":
        newRecord = {
          bloodPressure: recordData.bloodPressure,
          heartRate: recordData.heartRate,
          temperature: recordData.temperature,
          weight: recordData.weight,
          height: recordData.height,
          oxygenSaturation: recordData.oxygenSaturation,
          recordedAt: recordData.recordedAt || new Date(),
          recordedBy: recordData.recordedBy || "self-reported",
          notes: recordData.notes,
        };
        patient.vitalSigns.push(newRecord);
        break;

      case "emergency-contact":
        patient.emergencyContact = {
          name: recordData.name,
          relationship: recordData.relationship,
          phone: recordData.phone,
        };
        newRecord = patient.emergencyContact;
        break;

      case "insurance":
        patient.insuranceInfo = {
          provider: recordData.provider,
          policyNumber: recordData.policyNumber,
          groupNumber: recordData.groupNumber,
          coverageType: recordData.coverageType,
          validUntil: recordData.validUntil,
          copayAmount: recordData.copayAmount,
        };
        newRecord = patient.insuranceInfo;
        break;

      default:
        throw new ApiError("Invalid record type", 400);
    }

    await patient.save();

    res.status(201).json({
      success: true,
      data: newRecord,
      message: "Health record added successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const updateHealthRecord = async (req, res, next) => {
  try {
    const { type, recordId } = req.params;
    const updateData = req.body;
    const patient = await Patient.findById(req.user.id);

    if (!patient) {
      throw new ApiError("Patient not found", 404);
    }

    let updatedRecord;

    switch (type) {
      case "medical-history":
        const medicalIndex = patient.medicalHistory.findIndex(
          (record) => record._id.toString() === recordId
        );
        if (medicalIndex === -1) {
          throw new ApiError("Medical history record not found", 404);
        }
        Object.assign(patient.medicalHistory[medicalIndex], updateData);
        patient.medicalHistory[medicalIndex].updatedAt = new Date();
        updatedRecord = patient.medicalHistory[medicalIndex];
        break;

      case "medication":
        const medicationIndex = patient.currentMedications.findIndex(
          (record) => record._id.toString() === recordId
        );
        if (medicationIndex === -1) {
          throw new ApiError("Medication record not found", 404);
        }
        Object.assign(patient.currentMedications[medicationIndex], updateData);
        updatedRecord = patient.currentMedications[medicationIndex];
        break;

      case "vital-signs":
        const vitalIndex = patient.vitalSigns.findIndex(
          (record) => record._id.toString() === recordId
        );
        if (vitalIndex === -1) {
          throw new ApiError("Vital signs record not found", 404);
        }
        Object.assign(patient.vitalSigns[vitalIndex], updateData);
        updatedRecord = patient.vitalSigns[vitalIndex];
        break;

      default:
        throw new ApiError("Invalid record type", 400);
    }

    await patient.save();

    res.status(200).json({
      success: true,
      data: updatedRecord,
      message: "Health record updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const deleteHealthRecord = async (req, res, next) => {
  try {
    const { type, recordId } = req.params;
    const patient = await Patient.findById(req.user.id);

    if (!patient) {
      throw new ApiError("Patient not found", 404);
    }

    switch (type) {
      case "medical-history":
        patient.medicalHistory = patient.medicalHistory.filter(
          (record) => record._id.toString() !== recordId
        );
        break;

      case "medication":
        patient.currentMedications = patient.currentMedications.filter(
          (record) => record._id.toString() !== recordId
        );
        break;

      case "allergy":
        patient.allergies = patient.allergies.filter(
          (record) => record._id.toString() !== recordId
        );
        break;

      case "vital-signs":
        patient.vitalSigns = patient.vitalSigns.filter(
          (record) => record._id.toString() !== recordId
        );
        break;

      default:
        throw new ApiError("Invalid record type", 400);
    }

    await patient.save();

    res.status(200).json({
      success: true,
      message: "Health record deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const shareHealthRecordWithPharmacy = async (req, res, next) => {
  try {
    const { pharmacyId, recordIds, recordType } = req.body;
    const patient = await Patient.findById(req.user.id);

    if (!patient) {
      throw new ApiError("Patient not found", 404);
    }

    // Verify pharmacy exists
    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy) {
      throw new ApiError("Pharmacy not found", 404);
    }

    // Share medical history records
    if (recordType === "medical-history") {
      recordIds.forEach((recordId) => {
        const record = patient.medicalHistory.id(recordId);
        if (record) {
          const existingShare = record.sharedWithPharmacies.find(
            (share) => share.pharmacyId.toString() === pharmacyId
          );

          if (!existingShare) {
            record.sharedWithPharmacies.push({
              pharmacyId: pharmacyId,
              sharedAt: new Date(),
              approvalStatus: "pending",
            });
          }
        }
      });
    }

    await patient.save();

    // Create notification for pharmacy (if notification system exists)
    // TODO: Implement notification system

    res.status(200).json({
      success: true,
      message: "Health records shared with pharmacy successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const getSharedHealthRecords = async (req, res, next) => {
  try {
    const { pharmacyId } = req.params;
    const patient = await Patient.findById(req.user.id);

    if (!patient) {
      throw new ApiError("Patient not found", 404);
    }

    // Get medical history records shared with this pharmacy
    const sharedMedicalHistory = patient.medicalHistory.filter((record) =>
      record.sharedWithPharmacies.some(
        (share) => share.pharmacyId.toString() === pharmacyId
      )
    );

    // Get current medications (always shared for prescription fulfillment)
    const sharedMedications = patient.currentMedications;

    // Get relevant allergies (always shared for safety)
    const sharedAllergies = patient.allergies;

    res.status(200).json({
      success: true,
      data: {
        medicalHistory: sharedMedicalHistory,
        currentMedications: sharedMedications,
        allergies: sharedAllergies,
        patientInfo: {
          name: `${patient.firstName} ${patient.lastName}`,
          phone: patient.phone,
          dateOfBirth: patient.dateOfBirth,
          emergencyContact: patient.emergencyContact,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
