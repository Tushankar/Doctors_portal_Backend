import PharmacyApproval from "../models/PharmacyApproval.js";
import bcrypt from "bcryptjs";
import Pharmacy from "../models/Pharmacy.js";
import Patient from "../models/Patient.js";
import Admin from "../models/Admin.js";
import User from "../models/User.js";
import generateOTP from "../utils/generateOTP.js";
import OTP from "../models/OTP.js";
import {
  sendOTPEmail,
  sendApprovalEmail,
  sendRejectionEmail,
} from "../utils/sendEmail.js";

// Get all pending pharmacy approvals
export const getPendingPharmacyApprovals = async (req, res, next) => {
  try {
    const pendingApprovals = await PharmacyApproval.find({
      status: "pending",
    }).sort("-createdAt");

    res.status(200).json({
      success: true,
      count: pendingApprovals.length,
      data: pendingApprovals,
    });
  } catch (error) {
    next(error);
  }
};

// Get single pharmacy approval request
export const getPharmacyApproval = async (req, res, next) => {
  try {
    const approval = await PharmacyApproval.findById(req.params.id);

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: "Pharmacy approval request not found",
      });
    }

    res.status(200).json({
      success: true,
      data: approval,
    });
  } catch (error) {
    next(error);
  }
};

// Approve pharmacy registration
export const approvePharmacy = async (req, res, next) => {
  try {
    const { remarks } = req.body;
    // Fetch approval request including password
    const approval = await PharmacyApproval.findById(req.params.id).select(
      "+pharmacyData.password"
    );
    if (!approval) {
      return res.status(404).json({
        success: false,
        message: "Pharmacy approval request not found",
      });
    }
    if (approval.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "This request has already been processed",
      });
    }
    // Ensure password is hashed
    let passwordToUse = approval.pharmacyData.password;
    if (!passwordToUse.startsWith("$2b$")) {
      const salt = await bcrypt.genSalt(10);
      passwordToUse = await bcrypt.hash(passwordToUse, salt);
    }
    // Check if a user with this email already exists
    let newUser;
    const existingUser = await User.findOne({
      email: approval.pharmacyData.email,
    });
    if (existingUser) {
      newUser = existingUser;
      // Optionally update password or status
      existingUser.password = passwordToUse;
      existingUser.isActive = true;
      await existingUser.save();
    } else {
      // Create User account
      newUser = await User.create({
        email: approval.pharmacyData.email,
        password: passwordToUse,
        role: "pharmacy",
        isEmailVerified: false,
        isActive: true,
      });
    }
    // Create Pharmacy document with full details
    const pharmacy = await Pharmacy.create({
      userId: newUser._id,
      pharmacyName: approval.pharmacyData.pharmacyName,
      typeOfPharmacy: approval.pharmacyData.typeOfPharmacy,
      licenseNumber: approval.pharmacyData.licenseNumber,
      registeredPharmacist: approval.pharmacyData.pharmacistName,
      // Contact information
      contactInfo: {
        phone: approval.pharmacyData.phone,
        email: approval.pharmacyData.email,
      },
      address: approval.pharmacyData.address,
      location: approval.pharmacyData.location,
      operatingHours: approval.pharmacyData.operatingHours || {},
      services: (approval.pharmacyData.services || []).map((name) => ({
        name,
        description: "",
        available: true,
      })),
      // Map verification documents into documents collection, default type to 'other'
      documents: (approval.pharmacyData.verificationDocuments || []).map(
        (doc) => ({
          type: "other",
          filename: doc.documentType,
          originalName: doc.documentType,
          cloudinaryUrl: doc.documentUrl,
          cloudinaryPublicId: doc.cloudinaryPublicId || "",
          uploadedAt: doc.uploadedAt,
          verified: false,
        })
      ),
      deliveryAvailable: approval.pharmacyData.deliveryAvailable || false,
      deliveryRadius: approval.pharmacyData.deliveryRadius || 0,
    });
    // Update approval status
    approval.status = "approved";
    approval.adminRemarks = remarks;
    approval.reviewedBy = req.user.id;
    approval.reviewedAt = new Date();
    await approval.save();
    // Generate OTP for email verification
    const otp = generateOTP();
    await OTP.create({
      email: newUser.email,
      otp,
      purpose: "email_verification",
    });
    // Send approval email
    await sendApprovalEmail(newUser.email, {
      pharmacyName: pharmacy.pharmacyName,
      otp,
      remarks,
    });
    // Respond
    res.status(200).json({
      success: true,
      message: "Pharmacy approved successfully. Email verification required.",
      data: {
        pharmacy: {
          id: pharmacy._id,
          email: newUser.email,
          pharmacyName: pharmacy.pharmacyName,
          location: pharmacy.location,
          message: "Please check your email for OTP to complete registration",
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Reject pharmacy registration
export const rejectPharmacy = async (req, res, next) => {
  try {
    const { remarks } = req.body;

    if (!remarks) {
      return res.status(400).json({
        success: false,
        message: "Please provide rejection remarks",
      });
    }

    const approval = await PharmacyApproval.findById(req.params.id);

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: "Pharmacy approval request not found",
      });
    }

    if (approval.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "This request has already been processed",
      });
    }

    // Update approval status
    approval.status = "rejected";
    approval.adminRemarks = remarks;
    approval.reviewedBy = req.user.id;
    approval.reviewedAt = new Date();
    await approval.save();

    // Send rejection email
    try {
      await sendRejectionEmail(approval.pharmacyData.email, {
        pharmacyName: approval.pharmacyData.pharmacyName,
        remarks,
      });
    } catch (emailError) {
      console.error("Rejection email failed:", emailError.message);
      console.log(
        `Pharmacy ${approval.pharmacyData.pharmacyName} rejected. Email: ${approval.pharmacyData.email}`
      );
    }

    res.status(200).json({
      success: true,
      message: "Pharmacy registration rejected",
    });
  } catch (error) {
    next(error);
  }
};

// Get all pharmacies (approved)
export const getAllPharmacies = async (req, res, next) => {
  try {
    const pharmacies = await Pharmacy.find()
      .select("-password")
      .sort("-createdAt");

    res.status(200).json({
      success: true,
      count: pharmacies.length,
      data: pharmacies,
    });
  } catch (error) {
    next(error);
  }
};

// Get all patients
export const getAllPatients = async (req, res, next) => {
  try {
    const patients = await Patient.find()
      .select("-password")
      .sort("-createdAt");

    res.status(200).json({
      success: true,
      count: patients.length,
      data: patients,
    });
  } catch (error) {
    next(error);
  }
};

// Toggle user active status
export const toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent deactivating super admin
    if (user.role === "admin" && user.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: "Cannot deactivate super admin account",
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${
        user.isActive ? "activated" : "deactivated"
      } successfully`,
      data: {
        id: user._id,
        email: user.email,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get dashboard statistics
export const getDashboardStats = async (req, res, next) => {
  try {
    const [
      totalPatients,
      totalPharmacies,
      pendingApprovals,
      activeUsers,
      verifiedEmails,
    ] = await Promise.all([
      Patient.countDocuments(),
      Pharmacy.countDocuments({ isVerified: true }),
      PharmacyApproval.countDocuments({ status: "pending" }),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isEmailVerified: true }),
    ]);

    // Get recent registrations (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentRegistrations = await User.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
    });

    res.status(200).json({
      success: true,
      data: {
        totalPatients,
        totalPharmacies,
        pendingApprovals,
        activeUsers,
        verifiedEmails,
        recentRegistrations,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Create admin (only super admin can do this)
export const createAdmin = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, phone, permissions } =
      req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    // Create admin
    const admin = await Admin.create({
      email,
      password,
      role: "admin",
      firstName,
      lastName,
      phone,
      permissions: permissions || ["view_analytics"],
      isSuperAdmin: false,
    });

    // Generate OTP for email verification
    const otp = generateOTP();
    await OTP.create({
      email,
      otp,
      purpose: "email_verification",
    });

    // Send welcome email with OTP
    try {
      await sendOTPEmail(email, otp, "email_verification");
    } catch (emailError) {
      console.error("Email sending failed:", emailError.message);
      console.log(`Admin OTP for ${email}: ${otp}`);
    }

    res.status(201).json({
      success: true,
      message: "Admin created successfully",
      data: {
        id: admin._id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        permissions: admin.permissions,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get all admins
export const getAllAdmins = async (req, res, next) => {
  try {
    const admins = await Admin.find().select("-password").sort("-createdAt");

    res.status(200).json({
      success: true,
      count: admins.length,
      data: admins,
    });
  } catch (error) {
    next(error);
  }
};

// Update admin permissions
export const updateAdminPermissions = async (req, res, next) => {
  try {
    const { permissions } = req.body;
    const admin = await Admin.findById(req.params.id);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    // Cannot modify super admin permissions
    if (admin.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: "Cannot modify super admin permissions",
      });
    }

    admin.permissions = permissions;
    await admin.save();

    res.status(200).json({
      success: true,
      message: "Permissions updated successfully",
      data: {
        id: admin._id,
        email: admin.email,
        permissions: admin.permissions,
      },
    });
  } catch (error) {
    next(error);
  }
};
