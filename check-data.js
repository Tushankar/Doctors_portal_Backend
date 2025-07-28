import dotenv from "dotenv";
import connectDB from "./config/db.js";
import { Prescription } from "./models/Prescription.js";
import Pharmacy from "./models/Pharmacy.js";
import Patient from "./models/Patient.js";

dotenv.config();

async function checkData() {
  try {
    await connectDB();

    const prescriptions = await Prescription.find().limit(3);
    const pharmacies = await Pharmacy.find().limit(3);
    const patients = await Patient.find().limit(3);

    console.log("Found", prescriptions.length, "prescriptions");
    console.log("Found", pharmacies.length, "pharmacies");
    console.log("Found", patients.length, "patients");

    if (prescriptions.length > 0) {
      console.log("\nSample prescription:");
      console.log("ID:", prescriptions[0]._id);
      console.log("Patient:", prescriptions[0].patientId);
      console.log("Status:", prescriptions[0].status);
      console.log("Has OCR data:", !!prescriptions[0].ocrData);
    }

    if (pharmacies.length > 0) {
      console.log("\nSample pharmacy:");
      console.log("ID:", pharmacies[0]._id);
      console.log("Status:", pharmacies[0].status);
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

checkData();
