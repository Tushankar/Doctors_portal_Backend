// import express from 'express';
// import {
//   register,
//   login,
//   logout,
//   getMe,
//   verifyEmail,
//   resendOTP,
//   forgotPassword,
//   resetPassword
// } from '../controllers/authController.js';
// import { protect } from '../middleware/authMiddleware.js';

// const router = express.Router();

// router.post('/register', register);
// router.post('/login', login);
// router.post('/logout', logout);
// router.post('/verify-email', verifyEmail);
// router.post('/resend-otp', resendOTP);
// router.post('/forgot-password', forgotPassword);
// router.post('/reset-password', resetPassword);
// router.get('/me', protect, getMe);

// export default router;

import express from "express";
import mongoose from "mongoose";
import {
  register,
  login,
  logout,
  getMe,
  verifyEmail,
  resendOTP,
  forgotPassword,
  resetPassword,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import { createUploadMiddleware } from "../config/cloudinary.js";
// import { createUploadMiddleware } from '../config/fileUploadService.js';

// Create multer middleware for pharmacy verification documents
const pharmacyUpload = createUploadMiddleware("PHARMACY_VERIFICATION");

const router = express.Router();

router.post(
  "/register",
  pharmacyUpload.array("verificationDocuments", 5),
  register
);
router.post("/login", login);
router.post("/logout", logout);
router.post("/verify-email", verifyEmail);
router.post("/resend-otp", resendOTP);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/me", protect, getMe);

// Get user by ID (for patient details viewing in pharmacy)
router.get("/users/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }
    const User = mongoose.model("User");
    const user = await User.findById(id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

export default router;
