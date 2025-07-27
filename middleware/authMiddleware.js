// middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Admin from "../models/Admin.js";
import Pharmacy from "../models/Pharmacy.js";
import Patient from "../models/Patient.js";

export const protect = async (req, res, next) => {
  let token;

  console.log("[AUTH] Incoming request cookies:", req.cookies);

  // Check for token in cookies
  if (req.cookies.token) {
    token = req.cookies.token;
    console.log("[AUTH] Token found in cookies");
  } else {
    console.log("[AUTH] No token found in cookies");
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Not authorized to access this route",
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("[AUTH] Token decoded:", decoded);

    // Get user from token
    req.user = await User.findById(decoded.id).select("-password");
    console.log("[AUTH] User found:", req.user?.email || req.user?._id);

    if (!req.user) {
      console.log("[AUTH] No user found for decoded token ID");
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Get full user data based on role
    switch (req.user.role) {
      case "admin":
        const admin = await Admin.findById(req.user._id);
        if (admin) {
          req.user.isSuperAdmin = admin.isSuperAdmin;
          req.user.permissions = admin.permissions;
          // console.log("[AUTH] Admin privileges:", {
          //   isSuperAdmin: admin.isSuperAdmin,
          //   permissions: admin.permissions,
          // });
        }
        break;
      case "pharmacy":
        const pharmacy = await Pharmacy.findById(req.user._id);
        if (pharmacy) {
          req.user.isVerified = pharmacy.isVerified;
          console.log("[AUTH] Pharmacy verification status:", {
            isVerified: pharmacy.isVerified,
          });
        }
        break;
      default:
      // console.log("[AUTH] No extended role data processing required.");
    }

    next();
  } catch (error) {
    console.error("[AUTH ERROR] Token verification failed:", error.message);
    return res.status(401).json({
      success: false,
      message: "Not authorized to access this route",
    });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    // console.log("[AUTH] Authorize check for roles:", roles);
    if (!roles.includes(req.user.role)) {
      console.warn(`[AUTH] Unauthorized role: ${req.user.role}`);
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`,
      });
    }
    next();
  };
};

export const verifiedEmail = async (req, res, next) => {
  // console.log("[AUTH] Checking email verification status");
  if (!req.user.isEmailVerified) {
    console.warn("[AUTH] Email not verified");
    return res.status(403).json({
      success: false,
      message: "Please verify your email first",
    });
  }
  next();
};

export const checkPharmacyVerification = async (req, res, next) => {
  // console.log("[AUTH] Checking pharmacy verification status");
  if (req.user.role === "pharmacy" && !req.user.isVerified) {
    // console.warn("[AUTH] Pharmacy not verified");
    return res.status(403).json({
      success: false,
      message: "Your pharmacy registration is pending verification",
    });
  }
  next();
};

export const checkAdminPermission = (permission) => {
  return (req, res, next) => {
    // console.log("[AUTH] Checking admin permission for:", permission);

    if (req.user.role !== "admin") {
      // console.warn("[AUTH] User is not admin");
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    if (req.user.isSuperAdmin) {
      // console.log("[AUTH] Super admin bypass");
      return next();
    }

    if (!req.user.permissions.includes(permission)) {
      // console.warn("[AUTH] Missing required permission:", permission);
      return res.status(403).json({
        success: false,
        message: `Permission denied. Required permission: ${permission}`,
      });
    }

    next();
  };
};
