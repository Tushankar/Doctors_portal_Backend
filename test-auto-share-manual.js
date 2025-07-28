import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// Import models
import Patient from "./models/Patient.js";
import Pharmacy from "./models/Pharmacy.js";

async function testAutoShareHealthRecords() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB Connected");

    const patientId = "68877d9be8763c9c6eb4bf77"; // Kakali Saha
    const pharmacyId = "68865f668f8c1cb20eab8459"; // dfghj pharmacy

    console.log(`🧪 Testing autoShareHealthRecords manually`);
    console.log(`Patient ID: ${patientId}`);
    console.log(`Pharmacy ID: ${pharmacyId}`);

    // Replicate the autoShareHealthRecords logic
    const patient = await Patient.findById(patientId);
    if (!patient) {
      console.error(`Patient not found: ${patientId}`);
      process.exit(1);
    }

    console.log(`✅ Patient found: ${patient.firstName} ${patient.lastName}`);

    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy) {
      console.error(`Pharmacy not found: ${pharmacyId}`);
      process.exit(1);
    }

    console.log(`✅ Pharmacy found: ${pharmacy.pharmacyName}`);

    let recordsShared = 0;

    // Check existing health records
    console.log(`\n📋 Patient health records:`, {
      medicalHistory: patient.medicalHistory?.length || 0,
      allergies: patient.allergies?.length || 0,
      currentMedications: patient.currentMedications?.length || 0,
      vitalSigns: patient.vitalSigns?.length || 0,
      emergencyContacts: patient.emergencyContacts?.length || 0,
    });

    // Auto-share all medical history records
    if (patient.medicalHistory && patient.medicalHistory.length > 0) {
      console.log(
        `\n🏥 Processing ${patient.medicalHistory.length} medical history records`
      );
      patient.medicalHistory.forEach((record, index) => {
        console.log(`  Record ${index + 1}:`);
        console.log(`    Condition: ${record.condition}`);
        console.log(
          `    Current shares: ${record.sharedWithPharmacies?.length || 0}`
        );

        const existingShare = record.sharedWithPharmacies?.find(
          (share) => share.pharmacyId.toString() === pharmacyId.toString()
        );

        if (!existingShare) {
          console.log(`    ➕ Adding new share`);
          if (!record.sharedWithPharmacies) {
            record.sharedWithPharmacies = [];
          }
          record.sharedWithPharmacies.push({
            pharmacyId: pharmacyId,
            sharedAt: new Date(),
            approvalStatus: "approved",
          });
          recordsShared++;
        } else {
          console.log(`    ✅ Already shared with this pharmacy`);
        }
      });
    }

    // Auto-share all allergy records
    if (patient.allergies && patient.allergies.length > 0) {
      console.log(
        `\n🤧 Processing ${patient.allergies.length} allergy records`
      );
      patient.allergies.forEach((record, index) => {
        const existingShare = record.sharedWithPharmacies?.find(
          (share) => share.pharmacyId.toString() === pharmacyId.toString()
        );

        if (!existingShare) {
          console.log(`  Record ${index + 1}: Adding new share`);
          if (!record.sharedWithPharmacies) {
            record.sharedWithPharmacies = [];
          }
          record.sharedWithPharmacies.push({
            pharmacyId: pharmacyId,
            sharedAt: new Date(),
            approvalStatus: "approved",
          });
          recordsShared++;
        }
      });
    }

    // Auto-share all current medications
    if (patient.currentMedications && patient.currentMedications.length > 0) {
      console.log(
        `\n💊 Processing ${patient.currentMedications.length} current medication records`
      );
      patient.currentMedications.forEach((record, index) => {
        const existingShare = record.sharedWithPharmacies?.find(
          (share) => share.pharmacyId.toString() === pharmacyId.toString()
        );

        if (!existingShare) {
          console.log(`  Record ${index + 1}: Adding new share`);
          if (!record.sharedWithPharmacies) {
            record.sharedWithPharmacies = [];
          }
          record.sharedWithPharmacies.push({
            pharmacyId: pharmacyId,
            sharedAt: new Date(),
            approvalStatus: "approved",
          });
          recordsShared++;
        }
      });
    }

    // Auto-share vital signs
    if (patient.vitalSigns && patient.vitalSigns.length > 0) {
      console.log(
        `\n💓 Processing ${patient.vitalSigns.length} vital signs records`
      );
      patient.vitalSigns.forEach((record, index) => {
        const existingShare = record.sharedWithPharmacies?.find(
          (share) => share.pharmacyId.toString() === pharmacyId.toString()
        );

        if (!existingShare) {
          console.log(`  Record ${index + 1}: Adding new share`);
          if (!record.sharedWithPharmacies) {
            record.sharedWithPharmacies = [];
          }
          record.sharedWithPharmacies.push({
            pharmacyId: pharmacyId,
            sharedAt: new Date(),
            approvalStatus: "approved",
          });
          recordsShared++;
        }
      });
    }

    // Auto-share emergency contacts
    if (patient.emergencyContacts && patient.emergencyContacts.length > 0) {
      console.log(
        `\n☎️ Processing ${patient.emergencyContacts.length} emergency contact records`
      );
      patient.emergencyContacts.forEach((record, index) => {
        const existingShare = record.sharedWithPharmacies?.find(
          (share) => share.pharmacyId.toString() === pharmacyId.toString()
        );

        if (!existingShare) {
          console.log(`  Record ${index + 1}: Adding new share`);
          if (!record.sharedWithPharmacies) {
            record.sharedWithPharmacies = [];
          }
          record.sharedWithPharmacies.push({
            pharmacyId: pharmacyId,
            sharedAt: new Date(),
            approvalStatus: "approved",
          });
          recordsShared++;
        }
      });
    }

    console.log(
      `\n💾 About to save patient with ${recordsShared} new shared records`
    );

    if (recordsShared > 0) {
      await patient.save();
      console.log(
        `✅ Successfully shared ${recordsShared} health records with pharmacy ${pharmacyId}`
      );
    } else {
      console.log(
        `ℹ️ No new records to share (all already shared or no records exist)`
      );
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

testAutoShareHealthRecords();
