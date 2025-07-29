import mongoose from "mongoose";
import Pharmacy from "../models/Pharmacy.js";
import { InventoryItem } from "../models/InventoryItem.js";
import User from "../models/User.js";
import { fileUploadService } from "./fileUploadController.js";
import { Prescription } from "../models/Prescription.js";
import ApiError from "../utils/ApiError.js";
import {
  createPrescriptionApprovalNotification,
  createPrescriptionDeclineNotification,
} from "./advancedNotificationController.js";
import AdvancedNotification from "../models/AdvancedNotification.js";

// Export controller methods directly
// export const registerPharmacy = async (userId, pharmacyData, documents) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const [user, existingPharmacy, existingLicense] = await Promise.all([
//       User.findById(userId),
//       Pharmacy.findOne({ userId }),
//       Pharmacy.findOne({ licenseNumber: pharmacyData.licenseNumber }),
//     ]);

//     if (!user || user.role !== "pharmacy") {
//       const error = new Error("Invalid user or role");
//       error.statusCode = 400;
//       throw error;
//     }

//     if (existingPharmacy) {
//       const error = new Error("Pharmacy already exists for this user");
//       error.statusCode = 400;
//       throw error;
//     }

//     if (existingLicense) {
//       const error = new Error("License number already registered");
//       error.statusCode = 400;
//       throw error;
//     }

//     const uploadPromises = documents.map(async (doc) => {
//       const uploadResult = await fileUploadService.processUploadedFile(
//         doc.file
//       );
//       return {
//         type: doc.type,
//         filename: uploadResult.publicId,
//         originalName: doc.file.originalname,
//         cloudinaryUrl: uploadResult.secureUrl,
//         cloudinaryPublicId: uploadResult.publicId,
//         uploadedAt: new Date(),
//       };
//     });

//     const uploadedDocuments = await Promise.all(uploadPromises);

//     const pharmacy = new Pharmacy({
//       userId: new mongoose.Types.ObjectId(userId),
//       ...pharmacyData,
//       location: {
//         type: "Point",
//         coordinates: pharmacyData.location.coordinates,
//       },
//       documents: uploadedDocuments,
//       approvalStatus: "pending",
//       operatingHours: initializeOperatingHours(pharmacyData.operatingHours),
//       services: validateAndFormatServices(pharmacyData.services),
//     });

//     await pharmacy.save({ session });
//     await session.commitTransaction();

//     return {
//       success: true,
//       message: "Pharmacy registered successfully. Awaiting admin approval.",
//       data: pharmacy,
//     };
//   } catch (error) {
//     await session.abortTransaction();
//     if (error.statusCode) throw error;
//     if (error.code === 11000) {
//       const dupError = new Error("Duplicate key error");
//       dupError.statusCode = 400;
//       throw dupError;
//     }
//     const serverError = new Error("Failed to register pharmacy");
//     serverError.statusCode = 500;
//     throw serverError;
//   } finally {
//     session.endSession();
//   }
// };

export const getPharmacyByUserId = async (userId) => {
  try {
    const pharmacy = await Pharmacy.findOne({ userId })
      .populate("userId", "email profile.name")
      .populate("approvedBy", "profile.name")
      .populate("rejectedBy", "profile.name")
      .lean();

    if (!pharmacy) {
      const error = new Error("Pharmacy not found");
      error.statusCode = 404;
      throw error;
    }

    pharmacy.isCurrentlyOpen = checkIfCurrentlyOpen(pharmacy);
    pharmacy.nextOpeningTime = getNextOpeningTime(pharmacy);

    return {
      success: true,
      message: "Pharmacy retrieved successfully",
      data: pharmacy,
    };
  } catch (error) {
    if (error.statusCode) throw error;
    const serverError = new Error("Failed to retrieve pharmacy");
    serverError.statusCode = 500;
    throw serverError;
  }
};

export const searchPharmacies = async (searchOptions, paginationOptions) => {
  console.log(
    "searchPharmacies called with options:",
    searchOptions,
    paginationOptions
  );
  try {
    const {
      longitude,
      latitude,
      radius = 10000,
      city,
      state,
      services,
      rating,
      isOpen,
    } = searchOptions;

    const {
      page = 1,
      limit = 10,
      sort = "rating",
      order = "desc",
    } = paginationOptions;
    const skip = (page - 1) * limit;

    // Build base filter
    const baseMatch = {
      approvalStatus: "approved",
      isActive: true,
    };
    if (city) baseMatch["address.city"] = new RegExp(city, "i");
    if (state) baseMatch["address.state"] = new RegExp(state, "i");
    if (rating) baseMatch.rating = { $gte: parseFloat(rating) };
    if (services?.length) {
      baseMatch["services.name"] = {
        $in: services.map((s) => new RegExp(s, "i")),
      };
    }
    if (isOpen) {
      const currentDay = getCurrentDay();
      const currentTime = getCurrentTime();
      baseMatch[`operatingHours.${currentDay}.closed`] = false;
      baseMatch[`operatingHours.${currentDay}.open`] = { $lte: currentTime };
      baseMatch[`operatingHours.${currentDay}.close`] = { $gte: currentTime };
    }

    // Construct aggregation pipeline
    const pipeline = [];
    if (longitude && latitude) {
      // geoNear stage to compute distance in meters
      pipeline.push({
        $geoNear: {
          near: { type: "Point", coordinates: [longitude, latitude] },
          distanceField: "distance",
          spherical: true,
          maxDistance: radius,
          key: "location",
        },
      });
      // convert distance to kilometers
      pipeline.push({
        $addFields: { distance: { $divide: ["$distance", 1000] } },
      });
      // apply other filters
      pipeline.push({ $match: baseMatch });
    } else {
      pipeline.push({ $match: baseMatch });
    }
    // projection, sort, skip, limit
    pipeline.push(
      {
        $project: {
          pharmacyName: 1,
          address: 1,
          location: 1,
          rating: 1,
          reviewCount: 1,
          operatingHours: 1,
          services: 1,
          contactInfo: 1,
          distance: 1,
          servicesCount: { $size: "$services" },
        },
      },
      { $sort: { [sort]: order === "desc" ? -1 : 1 } },
      { $skip: skip },
      { $limit: limit }
    );

    // build count query based on filters (ignore geo filter in count)
    const countQuery = { ...baseMatch };
    const [results, count] = await Promise.all([
      Pharmacy.aggregate(pipeline),
      Pharmacy.countDocuments(countQuery),
    ]);

    const enhancedResults = results.map((pharmacy) => ({
      ...pharmacy,
      isCurrentlyOpen: checkIfCurrentlyOpen(pharmacy),
      nextOpeningTime: getNextOpeningTime(pharmacy),
    }));

    return {
      success: true,
      message: "Pharmacies retrieved successfully",
      data: enhancedResults,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit),
      },
      meta: {
        avgRating:
          results.reduce((acc, curr) => acc + curr.rating, 0) / results.length,
        totalServices: results.reduce(
          (acc, curr) => acc + curr.servicesCount,
          0
        ),
      },
    };
  } catch (err) {
    console.error("Error in searchPharmacies:", err);
    if (err.statusCode) throw err;
    const serverError = new Error(err.message || "Failed to search pharmacies");
    serverError.statusCode = 500;
    throw serverError;
  }
};

// Wrapper for fetching nearby pharmacies using geo queries
// Fetch nearby pharmacies unfiltered by approval for patient view
export const getNearbyPharmacies = async (searchOptions, paginationOptions) => {
  const { latitude, longitude, radius = 10000 } = searchOptions;
  const { limit = 20 } = paginationOptions;
  if (!latitude || !longitude) {
    const error = new Error("Latitude and longitude are required");
    error.statusCode = 400;
    throw error;
  }
  // GeoNear to compute distance (meters)
  const pipeline = [
    {
      $geoNear: {
        near: { type: "Point", coordinates: [longitude, latitude] },
        distanceField: "distance",
        spherical: true,
        maxDistance: radius,
        key: "location",
      },
    },
    // Convert to kilometers
    { $addFields: { distance: { $divide: ["$distance", 1000] } } },
    // Project full pharmacy details
    {
      $project: {
        _id: 1,
        name: "$pharmacyName",
        address: 1,
        contactInfo: 1,
        operatingHours: 1,
        services: 1,
        location: 1,
        distance: 1,
      },
    },
    // Limit results
    { $limit: limit },
  ];
  const results = await Pharmacy.aggregate(pipeline);
  return {
    success: true,
    message: "Nearby pharmacies retrieved successfully",
    data: results,
    pagination: { limit, total: results.length },
  };
};

// Fetch full pharmacy details by pharmacy ID
export const getPharmacyDetails = async (pharmacyId) => {
  try {
    // validate ObjectId
    if (!mongoose.isValidObjectId(pharmacyId)) {
      const error = new Error("Invalid pharmacy ID");
      error.statusCode = 400;
      throw error;
    }
    const pharmacy = await Pharmacy.findById(pharmacyId)
      .populate("userId", "email")
      .lean();
    console.log("getPharmacyDetails - fetched pharmacy:", pharmacy);
    console.log(
      "getPharmacyDetails - approval status:",
      pharmacy?.approvalStatus
    );
    console.log("getPharmacyDetails - approved at:", pharmacy?.approvedAt);
    console.log("getPharmacyDetails - is active:", pharmacy?.isActive);
    if (!pharmacy) {
      const error = new Error("Pharmacy not found");
      error.statusCode = 404;
      throw error;
    }
    // compute open status (temporarily disabled for debugging)
    // pharmacy.isCurrentlyOpen = checkIfCurrentlyOpen(pharmacy);
    // pharmacy.nextOpeningTime = getNextOpeningTime(pharmacy);
    return { success: true, data: pharmacy };
  } catch (err) {
    console.error("Error in getPharmacyDetails:", err);
    if (err.statusCode) throw err;
    const serverError = new Error(
      err.message || "Failed to fetch pharmacy details"
    );
    serverError.statusCode = 500;
    throw serverError;
  }
};

// Fetch inventory items for a given pharmacy
export const getPharmacyInventory = async (pharmacyId) => {
  const items = await InventoryItem.find({ pharmacyId }).lean();
  return { success: true, data: items };
};

export const updatePharmacy = async (pharmacyId, updateData, userId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const pharmacy = await Pharmacy.findById(pharmacyId);

    if (!pharmacy) {
      const error = new Error("Pharmacy not found");
      error.statusCode = 404;
      throw error;
    }

    if (pharmacy.userId.toString() !== userId) {
      const error = new Error("Unauthorized to update this pharmacy");
      error.statusCode = 403;
      throw error;
    }

    const sanitizedUpdates = sanitizeUpdates(updateData);

    if (sanitizedUpdates.location) {
      validateLocation(sanitizedUpdates.location);
    }

    if (sanitizedUpdates.operatingHours) {
      sanitizedUpdates.operatingHours = validateOperatingHours(
        sanitizedUpdates.operatingHours
      );
    }

    if (sanitizedUpdates.services) {
      sanitizedUpdates.services = validateAndFormatServices(
        sanitizedUpdates.services
      );
    }

    Object.assign(pharmacy, sanitizedUpdates);

    pharmacy.markModified("location");
    pharmacy.markModified("operatingHours");
    pharmacy.markModified("services");

    await pharmacy.save({ session });
    await session.commitTransaction();

    return {
      success: true,
      message: "Pharmacy updated successfully",
      data: pharmacy,
    };
  } catch (error) {
    await session.abortTransaction();
    if (error.statusCode) throw error;
    const serverError = new Error("Failed to update pharmacy");
    serverError.statusCode = 500;
    throw serverError;
  } finally {
    session.endSession();
  }
};

// ===== Prescription Handling for Pharmacies =====
/**
 * List incoming prescriptions (status 'uploaded')
 */
export const listIncomingPrescriptions = async (pharmacyId) => {
  try {
    const prescriptions = await Prescription.find({ status: "uploaded" })
      .sort({ createdAt: -1 })
      .lean();
    return { success: true, data: prescriptions };
  } catch (err) {
    throw new ApiError("Failed to list incoming prescriptions", 500);
  }
};

/**
 * Accept or decline a prescription
 */
export const respondToPrescription = async (
  prescriptionId,
  pharmacyId,
  action
) => {
  try {
    // Find prescription with patient data populated
    const prescription = await Prescription.findById(prescriptionId)
      .populate("patientId", "firstName lastName email profile")
      .populate("doctorId", "firstName lastName profile");

    if (!prescription) throw new ApiError("Prescription not found", 404);

    // Get pharmacy data
    const pharmacy = await Pharmacy.findById(pharmacyId).populate(
      "userId",
      "firstName lastName email"
    );

    if (!pharmacy) throw new ApiError("Pharmacy not found", 404);

    if (action === "accept") {
      prescription.status = "accepted";
      prescription.pharmacyId = pharmacyId;
      prescription.acceptedAt = new Date();
      prescription.acceptedBy = pharmacy.userId._id;

      await prescription.save();

      // Create notification for patient when prescription is approved
      try {
        await createPrescriptionApprovalNotification(
          prescription.patientId._id,
          prescriptionId,
          pharmacyId
        );
        console.log("✅ Prescription approval notification sent to patient");
      } catch (notificationError) {
        console.error(
          "❌ Failed to send prescription approval notification:",
          notificationError
        );
        // Don't throw error - prescription approval should still succeed
      }
    } else if (action === "decline") {
      prescription.status = "cancelled";
      prescription.cancelledAt = new Date();
      prescription.cancelledBy = pharmacy.userId._id;

      await prescription.save();

      // Create notification for patient when prescription is declined
      try {
        await createPrescriptionDeclineNotification(
          prescription.patientId._id,
          prescriptionId,
          pharmacyId,
          prescription.cancellationReason || ""
        );
        console.log("✅ Prescription decline notification sent to patient");
      } catch (notificationError) {
        console.error(
          "❌ Failed to send prescription decline notification:",
          notificationError
        );
        // Don't throw error - prescription decline should still succeed
      }
    } else {
      throw new ApiError("Invalid action", 400);
    }

    return { success: true, message: `Prescription ${action}ed successfully` };
  } catch (err) {
    throw err instanceof ApiError ? err : new ApiError(err.message, 500);
  }
};

/**
 * View prescription details
 */
export const viewPrescription = async (prescriptionId) => {
  try {
    const prescription = await Prescription.findById(prescriptionId)
      .populate("patientId", "profile.name email")
      .lean();
    if (!prescription) throw new ApiError("Prescription not found", 404);
    return { success: true, data: prescription };
  } catch (err) {
    throw err instanceof ApiError ? err : new ApiError(err.message, 500);
  }
};

/**
 * Update fulfillment status for a prescription
 */
export const updateFulfillmentStatus = async (prescriptionId, status) => {
  try {
    const prescription = await Prescription.findById(prescriptionId);
    if (!prescription) throw new ApiError("Prescription not found", 404);
    prescription.status = status;
    prescription.fulfillmentDetails = {
      ...(prescription.fulfillmentDetails || {}),
      status,
    };
    await prescription.save();
    return { success: true, message: "Fulfillment status updated" };
  } catch (err) {
    throw err instanceof ApiError ? err : new ApiError(err.message, 500);
  }
};

/**
 * Get prescription history for a pharmacy
 */
export const getPrescriptionHistory = async (pharmacyId) => {
  try {
    const history = await Prescription.find({ pharmacyId })
      .sort({ updatedAt: -1 })
      .lean();
    return { success: true, data: history };
  } catch (err) {
    throw new ApiError("Failed to retrieve prescription history", 500);
  }
};

// Helper functions
const initializeOperatingHours = (hours = {}) => {
  const defaultHours = {
    open: "09:00",
    close: "18:00",
    closed: false,
  };

  return {
    monday: { ...defaultHours, ...hours.monday },
    tuesday: { ...defaultHours, ...hours.tuesday },
    wednesday: { ...defaultHours, ...hours.wednesday },
    thursday: { ...defaultHours, ...hours.thursday },
    friday: { ...defaultHours, ...hours.friday },
    saturday: { ...defaultHours, close: "17:00", ...hours.saturday },
    sunday: {
      ...defaultHours,
      open: "10:00",
      close: "16:00",
      closed: true,
      ...hours.sunday,
    },
  };
};

const validateAndFormatServices = (services = []) => {
  return services
    .map((service) => ({
      name: service.name.trim(),
      description: service.description?.trim() || "",
      available: Boolean(service.available),
    }))
    .filter((service) => service.name.length > 0);
};

const validateLocation = (location) => {
  if (
    !location.coordinates ||
    !Array.isArray(location.coordinates) ||
    location.coordinates.length !== 2
  ) {
    const error = new Error("Invalid location coordinates");
    error.statusCode = 400;
    throw error;
  }

  const [longitude, latitude] = location.coordinates;

  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    const error = new Error("Invalid coordinates range");
    error.statusCode = 400;
    throw error;
  }
};

const sanitizeUpdates = (updates) => {
  const allowedUpdates = [
    "pharmacyName",
    "location",
    "address",
    "contactInfo",
    "operatingHours",
    "services",
  ];

  return Object.keys(updates)
    .filter((key) => allowedUpdates.includes(key))
    .reduce((obj, key) => {
      obj[key] = updates[key];
      return obj;
    }, {});
};

const getCurrentDay = () => {
  return [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ][new Date().getDay()];
};

const getCurrentTime = () => {
  return new Date().toTimeString().slice(0, 5);
};

const checkIfCurrentlyOpen = (pharmacy) => {
  const currentDay = getCurrentDay();
  const currentTime = getCurrentTime();
  const hours = pharmacy.operatingHours[currentDay];

  return (
    !hours.closed && currentTime >= hours.open && currentTime <= hours.close
  );
};

const getNextOpeningTime = (pharmacy) => {
  const currentDay = getCurrentDay();
  const currentTime = getCurrentTime();
  const daysOfWeek = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  let dayIndex = daysOfWeek.indexOf(currentDay);
  let daysChecked = 0;

  while (daysChecked < 7) {
    const checkDay = daysOfWeek[dayIndex];
    const hours = pharmacy.operatingHours[checkDay];

    if (
      !hours.closed &&
      (dayIndex > daysOfWeek.indexOf(currentDay) || currentTime < hours.open)
    ) {
      return {
        day: checkDay,
        time: hours.open,
      };
    }

    dayIndex = (dayIndex + 1) % 7;
    daysChecked++;
  }

  return null;
};

// Health Records Management for Pharmacies

export const getPatientHealthRecords = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const pharmacyId = req.user.pharmacyId;

    console.log("[INFO] Fetching health records for Patient ID:", patientId);
    console.log("[INFO] Requesting Pharmacy ID:", pharmacyId);

    // Import Patient model here to avoid circular dependency
    const Patient = (await import("../models/Patient.js")).default;

    const patient = await Patient.findById(patientId).select(
      "medicalHistory allergies currentMedications vitalSigns emergencyContact firstName lastName phone dateOfBirth"
    );

    if (!patient) {
      console.log("[ERROR] Patient not found with ID:", patientId);
      throw new ApiError("Patient not found", 404);
    }

    console.log("[INFO] Patient found:", {
      name: `${patient.firstName} ${patient.lastName}`,
      phone: patient.phone,
    });

    const sharedMedicalHistory = patient.medicalHistory.filter((record) =>
      record.sharedWithPharmacies.some(
        (share) =>
          share.pharmacyId.toString() === pharmacyId &&
          share.approvalStatus === "approved"
      )
    );

    console.log(
      "[INFO] Shared Medical History Length:",
      sharedMedicalHistory.length
    );

    const healthRecords = {
      patientInfo: {
        name: `${patient.firstName} ${patient.lastName}`,
        phone: patient.phone,
        dateOfBirth: patient.dateOfBirth,
        emergencyContact: patient.emergencyContact,
      },
      medicalHistory: sharedMedicalHistory,
      allergies: patient.allergies || [],
      currentMedications: patient.currentMedications || [],
      vitalSigns: patient.vitalSigns?.slice(-3) || [], // Last 3 vital sign records
    };

    console.log("[SUCCESS] Health records ready to send.");

    res.status(200).json({
      success: true,
      data: healthRecords,
    });
  } catch (error) {
    console.error("[EXCEPTION] getPatientHealthRecords Error:", error);
    next(error);
  }
};

export const approveHealthRecordAccess = async (req, res, next) => {
  try {
    const { patientId, recordId } = req.params;
    const { approvalStatus } = req.body; // 'approved' or 'rejected'
    const pharmacyId = req.user.pharmacyId;

    // Import Patient model here to avoid circular dependency
    const Patient = (await import("../models/Patient.js")).default;

    const patient = await Patient.findById(patientId);

    if (!patient) {
      throw new ApiError("Patient not found", 404);
    }

    // Find the medical history record and update approval status
    const record = patient.medicalHistory.id(recordId);
    if (!record) {
      throw new ApiError("Medical history record not found", 404);
    }

    const shareRecord = record.sharedWithPharmacies.find(
      (share) => share.pharmacyId.toString() === pharmacyId
    );

    if (!shareRecord) {
      throw new ApiError("No sharing request found for this pharmacy", 404);
    }

    shareRecord.approvalStatus = approvalStatus;
    shareRecord.approvedAt = new Date();

    await patient.save();

    res.status(200).json({
      success: true,
      message: `Health record access ${approvalStatus} successfully`,
    });
  } catch (error) {
    next(error);
  }
};

export const getPendingHealthRecordRequests = async (req, res, next) => {
  try {
    const pharmacyId = req.user.pharmacyId;

    // Import Patient model here to avoid circular dependency
    const Patient = (await import("../models/Patient.js")).default;

    const patients = await Patient.find({
      "medicalHistory.sharedWithPharmacies": {
        $elemMatch: {
          pharmacyId: pharmacyId,
          approvalStatus: "pending",
        },
      },
    }).select("firstName lastName phone medicalHistory");

    const pendingRequests = [];

    patients.forEach((patient) => {
      patient.medicalHistory.forEach((record) => {
        const pendingShare = record.sharedWithPharmacies.find(
          (share) =>
            share.pharmacyId.toString() === pharmacyId &&
            share.approvalStatus === "pending"
        );

        if (pendingShare) {
          pendingRequests.push({
            patientId: patient._id,
            patientName: `${patient.firstName} ${patient.lastName}`,
            patientPhone: patient.phone,
            recordId: record._id,
            condition: record.condition,
            diagnosedDate: record.diagnosedDate,
            sharedAt: pendingShare.sharedAt,
          });
        }
      });
    });

    res.status(200).json({
      success: true,
      data: pendingRequests,
    });
  } catch (error) {
    next(error);
  }
};

export const getPatientMedicationHistory = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const pharmacyId = req.user.pharmacyId;

    // Import models here to avoid circular dependency
    const Patient = (await import("../models/Patient.js")).default;
    const Order = (await import("../models/Order.js")).default;

    // Get patient's current medications
    const patient = await Patient.findById(patientId).select(
      "currentMedications prescriptionHistory firstName lastName"
    );

    if (!patient) {
      throw new ApiError("Patient not found", 404);
    }

    // Get orders fulfilled by this pharmacy for this patient
    const orders = await Order.find({
      patientId: patientId,
      pharmacyId: pharmacyId,
      status: { $in: ["delivered", "completed"] },
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        patientName: `${patient.firstName} ${patient.lastName}`,
        currentMedications: patient.currentMedications,
        orderHistory: orders,
        prescriptionHistory: patient.prescriptionHistory,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get shared health records from patients who have approved prescriptions with this pharmacy
export const getSharedHealthRecords = async (req, res, next) => {
  try {
    const { patientId } = req.params;

    // Find pharmacy document using the user ID (same pattern as other functions)
    const pharmacy = await Pharmacy.findOne({ userId: req.user.id });
    if (!pharmacy) {
      throw new ApiError("Pharmacy not found for this user", 404);
    }

    const pharmacyId = pharmacy._id;

    const Patient = (await import("../models/Patient.js")).default;
    const { Order } = await import("../models/Order.js");

    // Get patient with health records shared with this pharmacy
    const patient = await Patient.findById(patientId).select(
      "firstName lastName medicalHistory allergies currentMedications vitalSigns emergencyContacts"
    );

    if (!patient) {
      throw new ApiError("Patient not found", 404);
    }

    console.log(
      `[SHARED_HEALTH_RECORDS] Patient found: ${patient.firstName} ${patient.lastName}`
    );
    console.log(`[SHARED_HEALTH_RECORDS] Patient health records available:`, {
      medicalHistory: patient.medicalHistory?.length || 0,
      allergies: patient.allergies?.length || 0,
      currentMedications: patient.currentMedications?.length || 0,
      vitalSigns: patient.vitalSigns?.length || 0,
      emergencyContacts: patient.emergencyContacts?.length || 0,
    });

    console.log(
      `[SHARED_HEALTH_RECORDS] Pharmacy ID for filtering: ${pharmacyId}`
    );

    // Check if there are any orders between this patient and pharmacy (indicating approved relationship)
    const existingOrders = await Order.find({
      patientId: patientId,
      pharmacyId: pharmacyId,
    }).limit(1);

    const hasOrderRelationship = existingOrders.length > 0;
    console.log(
      `[SHARED_HEALTH_RECORDS] Has order relationship: ${hasOrderRelationship}`
    );

    // If there's an order relationship, auto-share health records
    if (hasOrderRelationship) {
      console.log(
        `[SHARED_HEALTH_RECORDS] Order relationship found, auto-sharing health records`
      );

      // Auto-share health records with this pharmacy
      let recordsShared = 0;

      // Share medical history
      if (patient.medicalHistory && patient.medicalHistory.length > 0) {
        patient.medicalHistory.forEach((record) => {
          const existingShare = record.sharedWithPharmacies?.find(
            (share) => share.pharmacyId.toString() === pharmacyId.toString()
          );

          if (!existingShare) {
            if (!record.sharedWithPharmacies) {
              record.sharedWithPharmacies = [];
            }
            record.sharedWithPharmacies.push({
              pharmacyId: pharmacyId,
              sharedAt: new Date(),
              approvalStatus: "approved",
            });
            recordsShared++;
          }
        });
      }

      // Share allergies
      if (patient.allergies && patient.allergies.length > 0) {
        patient.allergies.forEach((record) => {
          const existingShare = record.sharedWithPharmacies?.find(
            (share) => share.pharmacyId.toString() === pharmacyId.toString()
          );

          if (!existingShare) {
            if (!record.sharedWithPharmacies) {
              record.sharedWithPharmacies = [];
            }
            record.sharedWithPharmacies.push({
              pharmacyId: pharmacyId,
              sharedAt: new Date(),
              approvalStatus: "approved",
            });
            recordsShared++;
          }
        });
      }

      // Share current medications
      if (patient.currentMedications && patient.currentMedications.length > 0) {
        patient.currentMedications.forEach((record) => {
          const existingShare = record.sharedWithPharmacies?.find(
            (share) => share.pharmacyId.toString() === pharmacyId.toString()
          );

          if (!existingShare) {
            if (!record.sharedWithPharmacies) {
              record.sharedWithPharmacies = [];
            }
            record.sharedWithPharmacies.push({
              pharmacyId: pharmacyId,
              sharedAt: new Date(),
              approvalStatus: "approved",
            });
            recordsShared++;
          }
        });
      }

      // Share vital signs
      if (patient.vitalSigns && patient.vitalSigns.length > 0) {
        patient.vitalSigns.forEach((record) => {
          const existingShare = record.sharedWithPharmacies?.find(
            (share) => share.pharmacyId.toString() === pharmacyId.toString()
          );

          if (!existingShare) {
            if (!record.sharedWithPharmacies) {
              record.sharedWithPharmacies = [];
            }
            record.sharedWithPharmacies.push({
              pharmacyId: pharmacyId,
              sharedAt: new Date(),
              approvalStatus: "approved",
            });
            recordsShared++;
          }
        });
      }

      // Share emergency contacts
      if (patient.emergencyContacts && patient.emergencyContacts.length > 0) {
        patient.emergencyContacts.forEach((record) => {
          const existingShare = record.sharedWithPharmacies?.find(
            (share) => share.pharmacyId.toString() === pharmacyId.toString()
          );

          if (!existingShare) {
            if (!record.sharedWithPharmacies) {
              record.sharedWithPharmacies = [];
            }
            record.sharedWithPharmacies.push({
              pharmacyId: pharmacyId,
              sharedAt: new Date(),
              approvalStatus: "approved",
            });
            recordsShared++;
          }
        });
      }

      if (recordsShared > 0) {
        await patient.save();
        console.log(
          `[SHARED_HEALTH_RECORDS] Auto-shared ${recordsShared} health records`
        );
      }
    }

    // Filter records that are shared with this pharmacy and approved
    const sharedMedicalHistory = (patient.medicalHistory || []).filter(
      (record, index) => {
        console.log(`[FILTER] Medical History Record ${index + 1}:`);
        console.log(
          `  - Has sharedWithPharmacies: ${!!record.sharedWithPharmacies}`
        );
        console.log(
          `  - Shared count: ${record.sharedWithPharmacies?.length || 0}`
        );

        if (
          record.sharedWithPharmacies &&
          record.sharedWithPharmacies.length > 0
        ) {
          record.sharedWithPharmacies.forEach((share, shareIndex) => {
            console.log(`    Share ${shareIndex + 1}:`);
            console.log(`      - Pharmacy ID: ${share.pharmacyId}`);
            console.log(`      - Status: ${share.approvalStatus}`);
            console.log(
              `      - Matches our pharmacy: ${
                share.pharmacyId.toString() === pharmacyId.toString()
              }`
            );
            console.log(
              `      - Is approved: ${share.approvalStatus === "approved"}`
            );
          });
        }

        const share = record.sharedWithPharmacies?.find(
          (share) =>
            share.pharmacyId.toString() === pharmacyId.toString() &&
            share.approvalStatus === "approved"
        );
        console.log(`  - Record included: ${!!share}`);
        return share;
      }
    );

    console.log(
      `[SHARED_HEALTH_RECORDS] Filtered medical history count: ${sharedMedicalHistory.length}`
    );

    const sharedAllergies = (patient.allergies || []).filter(
      (record, index) => {
        console.log(`[FILTER] Allergy Record ${index + 1}:`);
        console.log(
          `  - Has sharedWithPharmacies: ${!!record.sharedWithPharmacies}`
        );
        console.log(
          `  - Shared count: ${record.sharedWithPharmacies?.length || 0}`
        );

        const share = record.sharedWithPharmacies?.find(
          (share) =>
            share.pharmacyId.toString() === pharmacyId.toString() &&
            share.approvalStatus === "approved"
        );
        console.log(`  - Record included: ${!!share}`);
        return share;
      }
    );

    console.log(
      `[SHARED_HEALTH_RECORDS] Filtered allergies count: ${sharedAllergies.length}`
    );

    const sharedCurrentMedications = (patient.currentMedications || []).filter(
      (record, index) => {
        console.log(`[FILTER] Medication Record ${index + 1}:`);
        console.log(
          `  - Has sharedWithPharmacies: ${!!record.sharedWithPharmacies}`
        );
        console.log(
          `  - Shared count: ${record.sharedWithPharmacies?.length || 0}`
        );

        const share = record.sharedWithPharmacies?.find(
          (share) =>
            share.pharmacyId.toString() === pharmacyId.toString() &&
            share.approvalStatus === "approved"
        );
        console.log(`  - Record included: ${!!share}`);
        return share;
      }
    );

    console.log(
      `[SHARED_HEALTH_RECORDS] Filtered medications count: ${sharedCurrentMedications.length}`
    );

    const sharedVitalSigns = (patient.vitalSigns || []).filter(
      (record, index) => {
        console.log(`[FILTER] Vital Signs Record ${index + 1}:`);
        console.log(
          `  - Has sharedWithPharmacies: ${!!record.sharedWithPharmacies}`
        );
        console.log(
          `  - Shared count: ${record.sharedWithPharmacies?.length || 0}`
        );

        const share = record.sharedWithPharmacies?.find(
          (share) =>
            share.pharmacyId.toString() === pharmacyId.toString() &&
            share.approvalStatus === "approved"
        );
        console.log(`  - Record included: ${!!share}`);
        return share;
      }
    );

    console.log(
      `[SHARED_HEALTH_RECORDS] Filtered vital signs count: ${sharedVitalSigns.length}`
    );

    const sharedEmergencyContacts = (patient.emergencyContacts || []).filter(
      (record, index) => {
        console.log(`[FILTER] Emergency Contact Record ${index + 1}:`);
        console.log(
          `  - Has sharedWithPharmacies: ${!!record.sharedWithPharmacies}`
        );
        console.log(
          `  - Shared count: ${record.sharedWithPharmacies?.length || 0}`
        );

        const share = record.sharedWithPharmacies?.find(
          (share) =>
            share.pharmacyId.toString() === pharmacyId.toString() &&
            share.approvalStatus === "approved"
        );
        console.log(`  - Record included: ${!!share}`);
        return share;
      }
    );

    res.status(200).json({
      success: true,
      data: {
        patientName: `${patient.firstName} ${patient.lastName}`,
        patientId: patient._id,
        healthRecords: {
          medicalHistory: sharedMedicalHistory,
          allergies: sharedAllergies,
          currentMedications: sharedCurrentMedications,
          vitalSigns: sharedVitalSigns,
          emergencyContacts: sharedEmergencyContacts,
        },
        recordCounts: {
          medicalHistory: sharedMedicalHistory.length,
          allergies: sharedAllergies.length,
          currentMedications: sharedCurrentMedications.length,
          vitalSigns: sharedVitalSigns.length,
          emergencyContacts: sharedEmergencyContacts.length,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
