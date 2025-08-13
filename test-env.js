import dotenv from "dotenv";

// Load environment variables
dotenv.config();

console.log("Environment Variables Test:");
console.log("EMAIL_USER:", process.env.EMAIL_USER || "MISSING");
console.log("EMAIL_PASS:", process.env.EMAIL_PASS ? "***HIDDEN***" : "MISSING");
console.log(
  "CLOUDINARY_CLOUD_NAME:",
  process.env.CLOUDINARY_CLOUD_NAME || "MISSING"
);
console.log("JWT_SECRET:", process.env.JWT_SECRET ? "***HIDDEN***" : "MISSING");
console.log("NODE_ENV:", process.env.NODE_ENV || "MISSING");
console.log("PORT:", process.env.PORT || "MISSING");

// Test email configuration
import nodemailer from "nodemailer";

try {
  const transporter = nodemailer.createTransporter({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  console.log("\n✅ Email transporter created successfully");

  // Test connection
  transporter.verify(function (error, success) {
    if (error) {
      console.log("❌ Email connection failed:", error.message);
    } else {
      console.log("✅ Email server connection successful");
    }
    process.exit(0);
  });
} catch (error) {
  console.log("❌ Error creating email transporter:", error.message);
  process.exit(1);
}
