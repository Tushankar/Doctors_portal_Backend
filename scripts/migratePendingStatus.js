import mongoose from "mongoose";
import dotenv from "dotenv";
import Patient from "../models/Patient.js";
import { Prescription } from "../models/Prescription.js";

// Load environment variables
dotenv.config();

async function migratePendingStatus() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Find all patients with "pending" status in prescription history
    const patientsWithPendingStatus = await Patient.find({
      "prescriptionHistory.status": "pending",
    });

    console.log(
      `Found ${patientsWithPendingStatus.length} patients with pending status in prescription history`
    );

    let updatedCount = 0;

    for (const patient of patientsWithPendingStatus) {
      let patientUpdated = false;

      // Update each prescription history entry with "pending" status
      for (const historyEntry of patient.prescriptionHistory) {
        if (historyEntry.status === "pending") {
          console.log(
            `Updating prescription history entry ${historyEntry.prescriptionId} for patient ${patient._id}`
          );

          // Try to get the actual prescription status
          try {
            const prescription = await Prescription.findById(
              historyEntry.prescriptionId
            );
            if (prescription) {
              historyEntry.status = prescription.status;
              console.log(
                `  Updated to actual prescription status: ${prescription.status}`
              );
            } else {
              // If prescription not found, set to a reasonable default
              historyEntry.status = "uploaded";
              console.log(`  Prescription not found, defaulted to: uploaded`);
            }
          } catch (error) {
            // If error getting prescription, set to uploaded
            historyEntry.status = "uploaded";
            console.log(`  Error getting prescription, defaulted to: uploaded`);
          }

          patientUpdated = true;
        }
      }

      if (patientUpdated) {
        // Save the patient with validation disabled to avoid the enum error
        await Patient.updateOne(
          { _id: patient._id },
          { prescriptionHistory: patient.prescriptionHistory },
          { runValidators: false }
        );
        updatedCount++;
        console.log(`Updated patient ${patient._id}`);
      }
    }

    console.log(`\nMigration completed! Updated ${updatedCount} patients.`);

    // Verify the migration
    const remainingPendingCount = await Patient.countDocuments({
      "prescriptionHistory.status": "pending",
    });

    console.log(
      `Remaining patients with "pending" status: ${remainingPendingCount}`
    );

    if (remainingPendingCount === 0) {
      console.log(
        "✅ Migration successful - no more 'pending' status values found!"
      );
    } else {
      console.log(
        "⚠️ Some 'pending' status values still remain. Manual review may be needed."
      );
    }
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

// Run the migration
migratePendingStatus().catch(console.error);
