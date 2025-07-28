// Quick fix script for pharmacy approval status
// Run this with: node fix-pharmacy-status.js

import mongoose from "mongoose";
import Pharmacy from "./models/Pharmacy.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Connect to MongoDB using the same connection string as the server
const MONGODB_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  "mongodb://localhost:27017/doctor-portal";

async function fixPharmacyStatuses() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    // Find all pharmacies with pending status
    const pendingPharmacies = await Pharmacy.find({
      approvalStatus: "pending",
    });
    console.log(
      `Found ${pendingPharmacies.length} pharmacies with pending status`
    );

    // Update all to approved status
    const result = await Pharmacy.updateMany(
      { approvalStatus: "pending" },
      {
        $set: {
          approvalStatus: "approved",
          approvedAt: new Date(),
        },
      }
    );

    console.log(
      `Updated ${result.modifiedCount} pharmacies to approved status`
    );

    // Verify the update
    const approvedPharmacies = await Pharmacy.find({
      approvalStatus: "approved",
    });
    console.log(`Total approved pharmacies: ${approvedPharmacies.length}`);

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  } catch (error) {
    console.error("Error fixing pharmacy statuses:", error);
    process.exit(1);
  }
}

fixPharmacyStatuses();
