import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// Import models
import Patient from "./models/Patient.js";

async function checkPatientHealthRecords() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB Connected");

    const patientId = "68877d9be8763c9c6eb4bf77"; // Kakali Saha
    const pharmacyId = "68865f668f8c1cb20eab8459"; // dfghj pharmacy

    const patient = await Patient.findById(patientId);

    if (!patient) {
      console.log("❌ Patient not found");
      process.exit(1);
    }

    console.log("👤 Patient Details:");
    console.log(`Name: ${patient.firstName} ${patient.lastName}`);
    console.log(`ID: ${patient._id}`);

    console.log("\n📋 Health Records:");

    // Medical History
    console.log(
      `\n🏥 Medical History (${patient.medicalHistory?.length || 0} records):`
    );
    if (patient.medicalHistory && patient.medicalHistory.length > 0) {
      patient.medicalHistory.forEach((record, index) => {
        console.log(`  Record ${index + 1}:`);
        console.log(`    Condition: ${record.condition}`);
        console.log(`    Status: ${record.status}`);
        console.log(`    Date: ${record.diagnosedDate}`);
        console.log(
          `    Shared with pharmacies: ${
            record.sharedWithPharmacies?.length || 0
          }`
        );

        if (
          record.sharedWithPharmacies &&
          record.sharedWithPharmacies.length > 0
        ) {
          record.sharedWithPharmacies.forEach((share, shareIndex) => {
            console.log(`      Share ${shareIndex + 1}:`);
            console.log(`        Pharmacy ID: ${share.pharmacyId}`);
            console.log(`        Status: ${share.approvalStatus}`);
            console.log(`        Shared At: ${share.sharedAt}`);
            console.log(
              `        Is our pharmacy: ${
                share.pharmacyId.toString() === pharmacyId.toString()
              }`
            );
          });
        } else {
          console.log("      ❌ Not shared with any pharmacies");
        }
        console.log("    ---");
      });
    }

    // Allergies
    console.log(`\n🤧 Allergies (${patient.allergies?.length || 0} records):`);
    if (patient.allergies && patient.allergies.length > 0) {
      patient.allergies.forEach((record, index) => {
        console.log(
          `  Record ${index + 1}: ${record.allergen} (${record.severity})`
        );
        console.log(
          `    Shared with pharmacies: ${
            record.sharedWithPharmacies?.length || 0
          }`
        );
      });
    }

    // Current Medications
    console.log(
      `\n💊 Current Medications (${
        patient.currentMedications?.length || 0
      } records):`
    );
    if (patient.currentMedications && patient.currentMedications.length > 0) {
      patient.currentMedications.forEach((record, index) => {
        console.log(`  Record ${index + 1}: ${record.name} ${record.dosage}`);
        console.log(
          `    Shared with pharmacies: ${
            record.sharedWithPharmacies?.length || 0
          }`
        );
      });
    }

    // Vital Signs
    console.log(
      `\n💓 Vital Signs (${patient.vitalSigns?.length || 0} records):`
    );
    if (patient.vitalSigns && patient.vitalSigns.length > 0) {
      patient.vitalSigns.forEach((record, index) => {
        console.log(
          `  Record ${index + 1}: BP ${record.bloodPressure}, HR ${
            record.heartRate
          }`
        );
        console.log(
          `    Shared with pharmacies: ${
            record.sharedWithPharmacies?.length || 0
          }`
        );
      });
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkPatientHealthRecords();
