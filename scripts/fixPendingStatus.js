import mongoose from "mongoose";
import { Prescription } from "../models/Prescription.js";

// Fix prescriptions with invalid "pending" status
async function fixPendingStatus() {
  try {
    console.log("Connecting to database...");
    await mongoose.connect(process.env.MONGODB_URI);

    console.log("Finding prescriptions with 'pending' status...");
    const prescriptionsWithPendingStatus = await Prescription.find({
      status: "pending",
    });

    console.log(
      `Found ${prescriptionsWithPendingStatus.length} prescriptions with invalid 'pending' status`
    );

    if (prescriptionsWithPendingStatus.length > 0) {
      // Update all prescriptions with "pending" status to "pending_approval"
      const result = await Prescription.updateMany(
        { status: "pending" },
        { status: "pending_approval" }
      );

      console.log(
        `Updated ${result.modifiedCount} prescriptions from 'pending' to 'pending_approval'`
      );

      // Log the updated prescriptions
      for (const prescription of prescriptionsWithPendingStatus) {
        console.log(`Fixed prescription ID: ${prescription._id}`);
      }
    }

    console.log("Status fix completed successfully!");
  } catch (error) {
    console.error("Error fixing pending status:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Database connection closed");
  }
}

// Run the fix if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fixPendingStatus();
}

export { fixPendingStatus };
