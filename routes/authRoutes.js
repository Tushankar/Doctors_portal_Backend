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

export default router;
