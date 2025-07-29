// middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Admin from "../models/Admin.js";
import Pharmacy from "../models/Pharmacy.js";
import Patient from "../models/Patient.js";

export const protect = async (req, res, next) => {
  let token;

  // Check for token in cookies first
  if (req.cookies.token) {
    token = req.cookies.token;
  }
  // Check for token in Authorization header
  else if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
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

    // Get user from token
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
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
        }
        break;
      case "pharmacy":
        const pharmacy = await Pharmacy.findById(req.user._id);
        if (pharmacy) {
          req.user.isVerified = pharmacy.isVerified;
        }
        break;
      default:
      // No extended role data processing required
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
    if (!roles.includes(req.user.role)) {
      console.log(
        `🔔 [AUTH] Access denied - User role '${req.user.role}' not in allowed roles:`,
        roles
      );
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`,
      });
    }
    next();
  };
};

export const verifiedEmail = async (req, res, next) => {
  if (!req.user.isEmailVerified) {
    return res.status(403).json({
      success: false,
      message: "Please verify your email first",
    });
  }
  next();
};

export const checkPharmacyVerification = async (req, res, next) => {
  if (req.user.role === "pharmacy" && !req.user.isVerified) {
    return res.status(403).json({
      success: false,
      message: "Your pharmacy registration is pending verification",
    });
  }
  next();
};

export const checkAdminPermission = (permission) => {
  return (req, res, next) => {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    if (req.user.isSuperAdmin) {
      return next();
    }

    if (!req.user.permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        message: `Permission denied. Required permission: ${permission}`,
      });
    }

    next();
  };
};
