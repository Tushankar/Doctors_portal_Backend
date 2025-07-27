import User from "../models/User.js";
import bcrypt from "bcryptjs";
import Patient from "../models/Patient.js";
// import { v2 as cloudinary } from "cloudinary";
import Pharmacy from "../models/Pharmacy.js";
import PharmacyApproval from "../models/PharmacyApproval.js";
import Admin from "../models/Admin.js";
import OTP from "../models/OTP.js";
import generateToken from "../utils/generateToken.js";
import generateOTP from "../utils/generateOTP.js";
import {
  sendOTPEmail,
  sendApprovalEmail,
  sendRejectionEmail,
} from "../utils/sendEmail.js";
import { createUploadMiddleware } from "../config/cloudinary.js";
const pharmacyUpload = createUploadMiddleware("PHARMACY_VERIFICATION");

export const register = async (req, res, next) => {
  try {
    const { email, password, role } = req.body;
    // Pull nested profileData object sent via form-data
    const profileData = req.body.profileData || {};

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    // Check if pharmacy approval request exists
    if (role === "pharmacy") {
      const approvalExists = await PharmacyApproval.findOne({
        "pharmacyData.email": email,
        status: "pending",
      });

      if (approvalExists) {
        return res.status(400).json({
          success: false,
          message: "Pharmacy approval request already pending",
        });
      }
    }

    let user;

    // Create user based on role
    switch (role) {
      case "patient":
        user = await Patient.create({
          email,
          password,
          role,
          ...profileData,
        });

        // Generate OTP for email verification
        const patientOtp = generateOTP();
        await OTP.create({
          email,
          otp: patientOtp,
          purpose: "email_verification",
        });
        // Debug: log the generated OTP
        console.log(`[DEBUG] Generated OTP for ${email}: ${patientOtp}`);

        // Try to send OTP email
        try {
          await sendOTPEmail(email, patientOtp, "email_verification");
          console.log(`OTP sent to ${email}: ${patientOtp}`);
        } catch (emailError) {
          console.error("Email sending failed:", emailError.message);
          console.log(`\n=================================`);
          console.log(`IMPORTANT: Email failed to send!`);
          console.log(`OTP for ${email}: ${patientOtp}`);
          console.log(`Use this OTP to verify the account`);
          console.log(`=================================\n`);
        }

        // Generate token
        const patientToken = generateToken(user._id);

        // Set cookie
        const patientCookieOptions = {
          expires: new Date(
            Date.now() + (process.env.COOKIE_EXPIRE || 7) * 24 * 60 * 60 * 1000
          ),
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
        };

        return res
          .status(201)
          .cookie("token", patientToken, patientCookieOptions)
          .json({
            success: true,
            message:
              "Registration successful. Please check your email for OTP.",
            user: {
              id: user._id,
              email: user.email,
              role: user.role,
              isEmailVerified: user.isEmailVerified,
            },
            token: patientToken,
          });

      case "pharmacy":
        // Debug: log entire request body to inspect form fields
        console.log("[DEBUG] register payload req.body:", req.body);
        // Reconstruct nested location fields from form-data if necessary
        if (
          !profileData.location &&
          req.body["profileData[location][coordinates]"]
        ) {
          let parsedCoords;
          try {
            parsedCoords = JSON.parse(
              req.body["profileData[location][coordinates]"]
            );
          } catch {
            parsedCoords = null;
          }
          profileData.location = {
            type: req.body["profileData[location][type]"] || "Point",
            coordinates: parsedCoords,
          };
        }
        // Parse location coordinates if sent as JSON string
        let coordinates = profileData.location?.coordinates;
        if (typeof coordinates === "string") {
          try {
            coordinates = JSON.parse(coordinates);
          } catch (e) {
            coordinates = null;
          }
        }
        // Debug: log parsed coordinates for validation
        console.log(
          "[DEBUG] Pharmacy registration - parsed coordinates:",
          coordinates
        );
        // Validate location data
        if (
          !profileData.location ||
          !Array.isArray(coordinates) ||
          coordinates.length !== 2 ||
          typeof coordinates[0] !== "number" ||
          typeof coordinates[1] !== "number" ||
          coordinates[0] < -180 ||
          coordinates[0] > 180 ||
          coordinates[1] < -90 ||
          coordinates[1] > 90
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Please provide valid location coordinates (longitude: -180 to 180, latitude: -90 to 90)",
          });
        }
        // Parse services and operating hours from FormData strings
        if (typeof profileData.services === "string") {
          try {
            profileData.services = JSON.parse(profileData.services);
          } catch (e) {
            profileData.services = [];
          }
        }
        if (typeof profileData.operatingHours === "string") {
          try {
            profileData.operatingHours = JSON.parse(profileData.operatingHours);
          } catch (e) {
            profileData.operatingHours = {};
          }
        }

        // Validate required pharmacy fields
        const requiredFields = [
          "pharmacyName",
          "typeOfPharmacy",
          "licenseNumber",
          "pharmacistName",
          "phone",
          "address",
        ];
        for (const field of requiredFields) {
          if (!profileData[field]) {
            return res.status(400).json({
              success: false,
              message: `Missing required field: ${field}`,
            });
          }
        }

        // Check if verification documents are provided
        if (!req.files || req.files.length === 0) {
          return res.status(400).json({
            success: false,
            message: "At least one verification document (PDF) is required",
          });
        }

        // Hash password for pharmacy approval
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Upload documents to Cloudinary
        let uploadedDocs = [];
        try {
          uploadedDocs = req.files.map((file) => ({
            documentType: file.originalname,
            documentUrl: file.path, // Cloudinary URL from multer-storage-cloudinary
            cloudinaryPublicId: file.filename, // Public ID from multer-storage-cloudinary
            uploadedAt: new Date(),
          }));
        } catch (uploadError) {
          console.error("Document upload failed:", uploadError);
          return res.status(500).json({
            success: false,
            message: "Failed to upload verification documents",
          });
        }

        // Create pharmacy approval request with all details
        const approvalRequest = await PharmacyApproval.create({
          pharmacyData: {
            email,
            password: hashedPassword,
            pharmacyName: profileData.pharmacyName,
            typeOfPharmacy: profileData.typeOfPharmacy,
            licenseNumber: profileData.licenseNumber,
            pharmacistName: profileData.pharmacistName,
            phone: profileData.phone,
            address: profileData.address,
            location: {
              type: "Point",
              coordinates: coordinates, // [lng, lat]
            },
            operatingHours: profileData.operatingHours || {},
            services: profileData.services || [],
            deliveryAvailable: profileData.deliveryAvailable || false,
            deliveryRadius: profileData.deliveryRadius || 0,
            verificationDocuments: uploadedDocs,
          },
        });

        // Notify admins about new pharmacy registration
        const admins = await Admin.find({
          $or: [{ permissions: "manage_pharmacies" }, { isSuperAdmin: true }],
        });

        // Send notification emails to admins
        for (const admin of admins) {
          try {
            await sendApprovalEmail(admin.email, {
              pharmacyName: profileData.pharmacyName,
              email: email,
              requestId: approvalRequest._id,
            });
          } catch (emailError) {
            console.error(`Failed to notify admin ${admin.email}:`, emailError);
          }
        }

        return res.status(201).json({
          success: true,
          message:
            "Pharmacy registration request submitted. Please wait for admin approval.",
          requestId: approvalRequest._id,
        });

      case "admin":
        // Create first admin without authorization check if no admins exist
        const adminCount = await Admin.countDocuments();

        if (adminCount === 0) {
          // First admin - create as super admin
          user = await Admin.create({
            email,
            password,
            role,
            isSuperAdmin: true,
            permissions: [
              "manage_users",
              "manage_pharmacies",
              "manage_patients",
              "view_transactions",
              "manage_settings",
              "view_analytics",
            ],
            ...profileData,
          });
        } else {
          // Subsequent admins - need super admin authorization
          if (!req.user || !req.user.isSuperAdmin) {
            return res.status(403).json({
              success: false,
              message: "Only super admin can create admin accounts",
            });
          }

          user = await Admin.create({
            email,
            password,
            role,
            permissions: profileData.permissions || ["view_analytics"],
            ...profileData,
          });
        }

        // Generate OTP for admin email verification
        const adminOtp = generateOTP();
        await OTP.create({
          email,
          otp: adminOtp,
          purpose: "email_verification",
        });
        // Debug: log the generated admin OTP
        console.log(`[DEBUG] Generated Admin OTP for ${email}: ${adminOtp}`);

        // Try to send OTP email
        try {
          await sendOTPEmail(email, adminOtp, "email_verification");
          console.log(`Admin OTP sent to ${email}: ${adminOtp}`);
        } catch (emailError) {
          console.error("Email sending failed:", emailError.message);
          console.log(`\n=================================`);
          console.log(`IMPORTANT: Email failed to send!`);
          console.log(`Admin OTP for ${email}: ${adminOtp}`);
          console.log(`Use this OTP to verify the account`);
          console.log(`=================================\n`);
        }

        // Generate token
        const adminToken = generateToken(user._id);

        // Set cookie
        const adminCookieOptions = {
          expires: new Date(
            Date.now() + (process.env.COOKIE_EXPIRE || 7) * 24 * 60 * 60 * 1000
          ),
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
        };

        return res
          .status(201)
          .cookie("token", adminToken, adminCookieOptions)
          .json({
            success: true,
            message:
              "Admin registration successful. Please check your email for OTP.",
            user: {
              id: user._id,
              email: user.email,
              role: user.role,
              isEmailVerified: user.isEmailVerified,
              isSuperAdmin: user.isSuperAdmin,
            },
            token: adminToken,
          });

      default:
        return res.status(400).json({
          success: false,
          message: "Invalid role",
        });
    }
  } catch (error) {
    console.error("Registration error:", error);
    next(error);
  }
};

// Login User
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    console.log("[LOGIN] Request received:", req.body); // 👈 Debug

    // Validate email & password
    if (!email || !password) {
      console.warn("[LOGIN] Missing email or password");
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Check for user
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      console.warn("[LOGIN] User not found:", email);
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    console.log("[LOGIN] User found:", user);

    // Check password
    const isPasswordMatch = await user.comparePassword(password);
    console.log("[USER] Comparing passwords...", password, user.password);
    console.log("[USER] Password match:", isPasswordMatch);

    if (!isPasswordMatch) {
      console.warn("[LOGIN] Incorrect password for:", email);
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    console.log("[LOGIN] Password matched");

    // Check if user is active
    if (!user.isActive) {
      console.warn("[LOGIN] User is not active:", user._id);
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated",
      });
    }

    // Check pharmacy verification status
    if (user.role === "pharmacy" && !user.isEmailVerified) {
      console.warn("[LOGIN] Pharmacy not verified:", user._id);
      return res.status(403).json({
        success: false,
        message: "Your pharmacy registration is pending admin approval",
      });
    }

    // Update last login for admin
    if (user.role === "admin") {
      await Admin.findByIdAndUpdate(user._id, { lastLogin: new Date() });
      console.log("[LOGIN] Admin last login updated:", user._id);
    }

    // Generate token
    const token = generateToken(user._id);
    console.log("[LOGIN] Token generated for:", user._id);

    // Set cookie options
    const cookieOptions = {
      expires: new Date(
        Date.now() + (process.env.COOKIE_EXPIRE || 7) * 24 * 60 * 60 * 1000
      ),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    };

    // Get full user data based on role
    console.log("[LOGIN] Fetching full user data for:", user);
    let fullUser;
    switch (user.role) {
      case "patient":
        fullUser = await Patient.findById(user._id);
        break;
      case "pharmacy":
        const pharmacy = await Pharmacy.findOne({ userId: user._id });
        if (pharmacy) {
          fullUser = {
            ...pharmacy.toObject(),
            email: user.email,
            role: user.role,
            isEmailVerified: user.isEmailVerified,
            isActive: user.isActive,
          };
        }
        break;

      case "admin":
        fullUser = await Admin.findById(user._id);
        break;
      default:
        console.warn("[LOGIN] Unknown user role:", user.role);
        break;
    }

    console.log(
      "[LOGIN] Full user fetched:----------------------------S",
      fullUser
    );

    res.status(200).cookie("token", token, cookieOptions).json({
      success: true,
      user: fullUser,
      token,
    });
  } catch (error) {
    console.error("[LOGIN] Error occurred:", error);
    next(error);
  }
};

// Verify Email
export const verifyEmail = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    // Find OTP
    const otpDoc = await OTP.findOne({
      email,
      otp,
      purpose: "email_verification",
    });

    if (!otpDoc) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    // Update user
    await User.updateOne({ email }, { isEmailVerified: true });

    // Delete OTP
    await OTP.deleteOne({ _id: otpDoc._id });

    res.status(200).json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Resend OTP
export const resendOTP = async (req, res, next) => {
  try {
    const { email, purpose } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Delete existing OTP
    await OTP.deleteMany({ email, purpose });

    // Generate new OTP
    const otp = generateOTP();
    await OTP.create({
      email,
      otp,
      purpose,
    });

    // Send OTP email
    try {
      await sendOTPEmail(email, otp, purpose);
      console.log(`OTP resent to ${email}: ${otp}`);
    } catch (emailError) {
      console.error("Email sending failed:", emailError.message);
      console.log(`\n=================================`);
      console.log(`IMPORTANT: Email failed to send!`);
      console.log(`OTP for ${email}: ${otp}`);
      console.log(`Use this OTP to verify the account`);
      console.log(`=================================\n`);
    }

    res.status(200).json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Logout
export const logout = async (req, res, next) => {
  res.cookie("token", "none", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
};

// Get Current User
export const getMe = async (req, res, next) => {
  try {
    let user;

    switch (req.user.role) {
      case "patient":
        user = await Patient.findById(req.user.id);
        break;
      case "pharmacy":
        user = await Pharmacy.findById(req.user.id);
        break;
      case "admin":
        user = await Admin.findById(req.user.id);
        break;
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

// Forgot Password
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Generate OTP
    const otp = generateOTP();
    await OTP.create({
      email,
      otp,
      purpose: "password_reset",
    });

    // Send OTP email
    try {
      await sendOTPEmail(email, otp, "password_reset");
    } catch (emailError) {
      console.error("Email sending failed:", emailError.message);
      console.log(`Password reset OTP for ${email}: ${otp}`);
    }

    res.status(200).json({
      success: true,
      message: "Password reset OTP sent to email",
    });
  } catch (error) {
    next(error);
  }
};

// Reset Password
export const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;

    // Find OTP
    const otpDoc = await OTP.findOne({
      email,
      otp,
      purpose: "password_reset",
    });

    if (!otpDoc) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    // Update password
    const user = await User.findOne({ email });
    user.password = newPassword;
    await user.save();

    // Delete OTP
    await OTP.deleteOne({ _id: otpDoc._id });

    res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    next(error);
  }
};
