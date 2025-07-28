import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// Import models
import User from "./models/User.js";
import Patient from "./models/Patient.js";
import Pharmacy from "./models/Pharmacy.js";
import { Prescription } from "./models/Prescription.js";

async function checkHealthRecordsData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB Connected");

    // Check patients with health records
    const patientsWithHealthRecords = await Patient.find({
      $or: [
        { "medicalHistory.0": { $exists: true } },
        { "allergies.0": { $exists: true } },
        { "currentMedications.0": { $exists: true } },
        { "vitalSigns.0": { $exists: true } },
        { "emergencyContacts.0": { $exists: true } },
      ],
    }).select(
      "firstName lastName medicalHistory allergies currentMedications vitalSigns emergencyContacts"
    );

    console.log("\n📋 Patients with Health Records:");
    patientsWithHealthRecords.forEach((patient, index) => {
      console.log(
        `${index + 1}. ${patient.firstName} ${patient.lastName} (${
          patient._id
        })`
      );
      console.log(
        `   Medical History: ${patient.medicalHistory?.length || 0} records`
      );
      console.log(`   Allergies: ${patient.allergies?.length || 0} records`);
      console.log(
        `   Current Medications: ${
          patient.currentMedications?.length || 0
        } records`
      );
      console.log(`   Vital Signs: ${patient.vitalSigns?.length || 0} records`);
      console.log(
        `   Emergency Contacts: ${
          patient.emergencyContacts?.length || 0
        } records`
      );

      // Check if any records are shared with pharmacies
      let hasSharedRecords = false;
      [
        patient.medicalHistory,
        patient.allergies,
        patient.currentMedications,
        patient.vitalSigns,
        patient.emergencyContacts,
      ].forEach((recordType) => {
        if (recordType && recordType.length > 0) {
          recordType.forEach((record) => {
            if (
              record.sharedWithPharmacies &&
              record.sharedWithPharmacies.length > 0
            ) {
              hasSharedRecords = true;
              console.log(
                `   📤 Shared records found: ${record.sharedWithPharmacies.length} pharmacies`
              );
              record.sharedWithPharmacies.forEach((share) => {
                console.log(
                  `      - Pharmacy: ${share.pharmacyId}, Status: ${share.approvalStatus}`
                );
              });
            }
          });
        }
      });

      if (!hasSharedRecords) {
        console.log(`   ❌ No shared health records found`);
      }
      console.log("---");
    });

    // Check prescriptions and their status
    const prescriptions = await Prescription.find({})
      .select("patientId pharmacyId status createdAt")
      .populate("patientId", "firstName lastName")
      .populate("pharmacyId", "pharmacyName")
      .sort({ createdAt: -1 })
      .limit(10);

    console.log("\n💊 Recent Prescriptions:");
    prescriptions.forEach((prescription, index) => {
      console.log(
        `${index + 1}. Patient: ${prescription.patientId?.firstName} ${
          prescription.patientId?.lastName
        }`
      );
      console.log(`   Pharmacy: ${prescription.pharmacyId?.pharmacyName}`);
      console.log(`   Status: ${prescription.status}`);
      console.log(`   Date: ${prescription.createdAt}`);
      console.log(`   Prescription ID: ${prescription._id}`);
      console.log("---");
    });

    // Check for specific patient's shared records
    if (patientsWithHealthRecords.length > 0) {
      const testPatient = patientsWithHealthRecords[0];
      console.log(
        `\n🔍 Detailed check for patient: ${testPatient.firstName} ${testPatient.lastName}`
      );

      // Check each health record type for sharing details
      [
        "medicalHistory",
        "allergies",
        "currentMedications",
        "vitalSigns",
        "emergencyContacts",
      ].forEach((recordType) => {
        const records = testPatient[recordType];
        if (records && records.length > 0) {
          console.log(`\n📋 ${recordType}:`);
          records.forEach((record, index) => {
            console.log(`  Record ${index + 1}:`);
            console.log(
              `    Content: ${JSON.stringify(record, null, 2).substring(
                0,
                200
              )}...`
            );
            if (record.sharedWithPharmacies) {
              console.log(
                `    Shared with: ${record.sharedWithPharmacies.length} pharmacies`
              );
              record.sharedWithPharmacies.forEach((share) => {
                console.log(
                  `      - Pharmacy: ${share.pharmacyId}, Status: ${share.approvalStatus}, Date: ${share.sharedAt}`
                );
              });
            } else {
              console.log(`    ❌ Not shared with any pharmacies`);
            }
          });
        }
      });
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkHealthRecordsData();
