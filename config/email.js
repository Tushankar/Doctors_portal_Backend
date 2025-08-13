// config/email.js
import dotenv from "dotenv";
import nodemailer from "nodemailer";

// Load environment variables first
dotenv.config();

// Use environment variables for email configuration
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

console.log("EMAIL_USER:", EMAIL_USER ? "✓ Loaded" : "✗ Missing");
console.log("EMAIL_PASS:", EMAIL_PASS ? "✓ Loaded" : "✗ Missing");

// Validate that email credentials are available
if (!EMAIL_USER || !EMAIL_PASS) {
  console.error("❌ Email credentials missing from environment variables");
  console.error(
    "Make sure EMAIL_USER and EMAIL_PASS are set in your .env file"
  );
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
  // Add additional configuration for better reliability
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
});

// Verify connection configuration
transporter.verify(function (error, success) {
  if (error) {
    console.log("Email configuration error:", error);
  } else {
    console.log("Email server is ready to send messages");
  }
});

export default transporter;
