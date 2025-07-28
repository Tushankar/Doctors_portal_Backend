import mongoose from "mongoose";
import dotenv from "dotenv";

// Import models
import User from "./models/User.js";
import Patient from "./models/Patient.js";
import Pharmacy from "./models/Pharmacy.js";

dotenv.config();

async function checkUserData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB Connected");

    // Get all users with their roles
    const users = await User.find({}).select("email role firstName lastName");
    console.log("\n📋 All Users:");
    users.forEach((user, index) => {
      console.log(`${index + 1}. Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Name: ${user.firstName} ${user.lastName}`);
      console.log(`   ID: ${user._id}`);
      console.log("---");
    });

    // Get patients with their user IDs
    const patients = await Patient.find({}).select("firstName lastName userId");
    console.log("\n🏥 Patients:");
    patients.forEach((patient, index) => {
      console.log(
        `${index + 1}. Name: ${patient.firstName} ${patient.lastName}`
      );
      console.log(`   Patient ID: ${patient._id}`);
      console.log(`   User ID: ${patient.userId}`);
      console.log("---");
    });

    // Get pharmacies with their user IDs
    const pharmacies = await Pharmacy.find({}).select(
      "pharmacyName userId status"
    );
    console.log("\n💊 Pharmacies:");
    pharmacies.forEach((pharmacy, index) => {
      console.log(`${index + 1}. Name: ${pharmacy.pharmacyName}`);
      console.log(`   Pharmacy ID: ${pharmacy._id}`);
      console.log(`   User ID: ${pharmacy.userId}`);
      console.log(`   Status: ${pharmacy.status}`);
      console.log("---");
    });

    // Find matching pairs
    console.log("\n🔗 User-Patient-Pharmacy Links:");
    for (const user of users) {
      if (user.role === "patient") {
        const patient = patients.find(
          (p) => p.userId?.toString() === user._id.toString()
        );
        if (patient) {
          console.log(
            `✅ Patient: ${user.email} -> ${patient.firstName} ${patient.lastName} (${patient._id})`
          );
        }
      } else if (user.role === "pharmacy") {
        const pharmacy = pharmacies.find(
          (p) => p.userId?.toString() === user._id.toString()
        );
        if (pharmacy) {
          console.log(
            `✅ Pharmacy: ${user.email} -> ${pharmacy.pharmacyName} (${pharmacy._id})`
          );
        }
      }
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkUserData();
