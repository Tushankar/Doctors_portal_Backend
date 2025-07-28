import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// Import models
import { Prescription } from "./models/Prescription.js";
import Patient from "./models/Patient.js";
import Pharmacy from "./models/Pharmacy.js";

async function checkPrescriptionStatus() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB Connected");

    // Get all prescriptions with details
    const prescriptions = await Prescription.find({})
      .populate("patientId", "firstName lastName")
      .populate("pharmacyId", "pharmacyName")
      .sort({ createdAt: -1 })
      .limit(15);

    console.log("\n📋 All Prescriptions (Recent):");
    prescriptions.forEach((prescription, index) => {
      console.log(`${index + 1}. Prescription ID: ${prescription._id}`);
      console.log(
        `   Patient: ${prescription.patientId?.firstName || "Unknown"} ${
          prescription.patientId?.lastName || ""
        }`
      );
      console.log(
        `   Patient ID: ${
          prescription.patientId?._id || prescription.patientId
        }`
      );
      console.log(
        `   Pharmacy: ${prescription.pharmacyId?.pharmacyName || "Unknown"}`
      );
      console.log(
        `   Pharmacy ID: ${
          prescription.pharmacyId?._id || prescription.pharmacyId
        }`
      );
      console.log(`   Status: ${prescription.status}`);
      console.log(`   Created: ${prescription.createdAt}`);

      // Check approval requests
      if (
        prescription.approvalRequests &&
        prescription.approvalRequests.length > 0
      ) {
        console.log(`   Approval Requests:`);
        prescription.approvalRequests.forEach((approval, idx) => {
          console.log(
            `     ${idx + 1}. Pharmacy: ${approval.pharmacyId}, Status: ${
              approval.status
            }, Date: ${approval.requestedAt}`
          );
        });
      } else {
        console.log(`   ❌ No approval requests`);
      }
      console.log("---");
    });

    // Find any prescription that has "accepted" status (which should have triggered sharing)
    const acceptedPrescriptions = await Prescription.find({
      status: "accepted",
    });
    console.log(
      `\n🔍 Found ${acceptedPrescriptions.length} prescriptions with 'accepted' status`
    );

    if (acceptedPrescriptions.length > 0) {
      for (const prescription of acceptedPrescriptions) {
        console.log(`\n📋 Checking accepted prescription: ${prescription._id}`);
        console.log(`   Patient ID: ${prescription.patientId}`);
        console.log(`   Pharmacy ID: ${prescription.pharmacyId}`);

        // Check if the patient has shared health records with this pharmacy
        const patient = await Patient.findById(prescription.patientId).select(
          "firstName lastName medicalHistory allergies currentMedications vitalSigns emergencyContacts"
        );

        if (patient) {
          console.log(`   Patient: ${patient.firstName} ${patient.lastName}`);

          let foundSharedRecords = false;
          const recordTypes = [
            "medicalHistory",
            "allergies",
            "currentMedications",
            "vitalSigns",
            "emergencyContacts",
          ];

          recordTypes.forEach((recordType) => {
            const records = patient[recordType] || [];
            records.forEach((record) => {
              if (
                record.sharedWithPharmacies &&
                record.sharedWithPharmacies.length > 0
              ) {
                const sharedWithThisPharmacy = record.sharedWithPharmacies.find(
                  (share) =>
                    share.pharmacyId.toString() ===
                    prescription.pharmacyId.toString()
                );
                if (sharedWithThisPharmacy) {
                  foundSharedRecords = true;
                  console.log(
                    `   ✅ Found shared ${recordType} record with pharmacy ${prescription.pharmacyId}`
                  );
                  console.log(
                    `      Status: ${sharedWithThisPharmacy.approvalStatus}, Shared: ${sharedWithThisPharmacy.sharedAt}`
                  );
                }
              }
            });
          });

          if (!foundSharedRecords) {
            console.log(
              `   ❌ No health records shared with pharmacy despite accepted prescription`
            );
          }
        }
      }
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkPrescriptionStatus();
