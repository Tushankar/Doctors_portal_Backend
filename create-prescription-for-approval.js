import dotenv from "dotenv";
import connectDB from "./config/db.js";
import { Prescription } from "./models/Prescription.js";
import Pharmacy from "./models/Pharmacy.js";

dotenv.config();

async function createPrescriptionForApproval() {
  try {
    await connectDB();

    // Get the logged-in pharmacy
    const pharmacy = await Pharmacy.findOne({
      userId: "6887389e8b076b4e0dad1e6b",
    });
    if (!pharmacy) {
      console.log("Pharmacy not found");
      return;
    }

    console.log(
      "Creating prescription approval request for pharmacy:",
      pharmacy.pharmacyName
    );

    // Create a new prescription with approval request
    const prescriptionData = {
      patientId: "6886362e34cc757998c0e446", // Test patient
      originalFile: {
        publicId: "test_prescription_" + Date.now(),
        secureUrl: "https://example.com/test-prescription.png",
        originalName: "test-prescription.png",
        format: "png",
        bytes: 50000,
        resourceType: "auto",
      },
      ocrData: {
        extractedText:
          "Test prescription with medications for approval testing",
        medications: [
          {
            name: "Aspirin",
            dosage: "100mg",
            frequency: "once daily",
            instructions: "Take with food after breakfast",
            confidence: 0.9,
          },
          {
            name: "Metformin",
            dosage: "500mg",
            frequency: "twice daily",
            instructions: "Take before meals",
            confidence: 0.85,
          },
        ],
        confidence: 0.87,
        processingStatus: "completed",
        processedAt: new Date(),
      },
      status: "pending_approval",
      description: "Test prescription for approval workflow",
      patientNotes: "Please process this prescription for testing",
      approvalRequests: [
        {
          pharmacyId: pharmacy._id,
          status: "pending",
          requestedAt: new Date(),
        },
      ],
      validationResults: {
        isValid: true,
        flags: [],
        aiConfidence: 0.87,
        reviewRequired: false,
        validatedAt: new Date(),
      },
    };

    const prescription = await Prescription.create(prescriptionData);
    console.log("✅ Test prescription created successfully:");
    console.log("- Prescription ID:", prescription._id);
    console.log("- Status:", prescription.status);
    console.log("- Patient ID:", prescription.patientId);
    console.log("- Pharmacy ID for approval:", pharmacy._id);
    console.log(
      "- Approval request status:",
      prescription.approvalRequests[0].status
    );
    console.log("- Medications:", prescription.ocrData.medications.length);

    console.log(
      "\nNow go to the pharmacy dashboard to see the pending approval request!"
    );

    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    console.error("Stack:", error.stack);
    process.exit(1);
  }
}

createPrescriptionForApproval();
