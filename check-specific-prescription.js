import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// Import models
import { Prescription } from "./models/Prescription.js";

async function checkSpecificPrescription() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB Connected");

    const prescriptionId = "688781258d12c081900349a4";

    const prescription = await Prescription.findById(prescriptionId);

    if (!prescription) {
      console.log("❌ Prescription not found");
      process.exit(1);
    }

    console.log("📋 Prescription Details:");
    console.log(`ID: ${prescription._id}`);
    console.log(`Patient ID: ${prescription.patientId}`);
    console.log(`Pharmacy ID: ${prescription.pharmacyId}`);
    console.log(`Status: ${prescription.status}`);
    console.log(`Created: ${prescription.createdAt}`);
    console.log(`Updated: ${prescription.updatedAt}`);

    console.log("\n📋 Approval Requests:");
    if (
      prescription.approvalRequests &&
      prescription.approvalRequests.length > 0
    ) {
      prescription.approvalRequests.forEach((approval, index) => {
        console.log(`${index + 1}. Pharmacy: ${approval.pharmacyId}`);
        console.log(`   Status: ${approval.status}`);
        console.log(`   Requested: ${approval.requestedAt}`);
        console.log(`   Responded: ${approval.respondedAt || "Not yet"}`);
        console.log("---");
      });
    } else {
      console.log("No approval requests found");
    }

    // Check if the pharmacy we're testing with has already approved
    const pharmacyId = "68865f668f8c1cb20eab8459"; // dfghj pharmacy ID
    const existingApproval = prescription.approvalRequests.find(
      (approval) => approval.pharmacyId.toString() === pharmacyId.toString()
    );

    if (existingApproval) {
      console.log(
        `\n🔍 Status for pharmacy ${pharmacyId}: ${existingApproval.status}`
      );
      if (existingApproval.status === "approved") {
        console.log("⚠️  This pharmacy has already approved this prescription");
        console.log(
          "   This is why autoShareHealthRecords is not being called again"
        );
      }
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkSpecificPrescription();
