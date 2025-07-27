// server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import connectDB from "./config/db.js";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";

// Route imports
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import prescriptionRoutes from "./routes/prescriptionRoutes.js";
import patientRoutes from "./routes/patientRoutes.js";

// Load env vars
dotenv.config();

import pharmacyRoutes from "./routes/pharmacyRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
// Connect to database
connectDB();

const app = express();

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser
app.use(cookieParser());

// Enable CORS
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.FRONTEND_URL
        : "http://localhost:5173",
    credentials: true,
  })
);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
// Prescription routes
app.use("/api/v1/prescriptions", prescriptionRoutes);
// Pharmacy routes
app.use("/api/v1/pharmacies", pharmacyRoutes);
// Inventory routes for CSV upload and product management
app.use("/api/v1/pharmacies", inventoryRoutes);
// Chat routes for patient-pharmacy messaging
app.use("/api/v1/chat", chatRoutes);
// Order routes for order management
app.use("/api/v1/orders", orderRoutes);
// Patient routes
app.use("/api/v1/patients", patientRoutes);

// Test route
app.get("/", (req, res) => {
  res.send("API is running...");
});

// Error middleware
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
