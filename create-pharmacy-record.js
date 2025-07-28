import mongoose from "mongoose";
import User from "./models/User.js";
import Pharmacy from "./models/Pharmacy.js";
import dotenv from "dotenv";

dotenv.config();

async function createPharmacyRecord() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const userId = "68874bcc5876e99b435758a7";
    const user = await User.findById(userId);

    if (user) {
      console.log(`User: ${user.email} (role: ${user.role})`);

      // Check if pharmacy already exists
      const existingPharmacy = await Pharmacy.findOne({ userId });
      if (existingPharmacy) {
        console.log(
          `✅ Pharmacy already exists: ${existingPharmacy.pharmacyName}`
        );
        return;
      }

      // Create new pharmacy record
      const pharmacy = new Pharmacy({
        userId: userId,
        pharmacyName: "SS Green Life Pharmacy",
        typeOfPharmacy: "retail",
        licenseNumber: "PH" + Date.now(),
        registeredPharmacist: "Dr. Rajesh Kumar",
        location: {
          type: "Point",
          coordinates: [88.3639, 22.5726], // Kolkata coordinates [longitude, latitude]
        },
        contactInfo: {
          email: user.email,
          phone: "+91-9876543210",
        },
        address: {
          street: "123 Medical Street",
          city: "Kolkata",
          state: "West Bengal",
          zipCode: "700001",
          country: "India",
        },
        operatingHours: {
          monday: { open: "09:00", close: "21:00" },
          tuesday: { open: "09:00", close: "21:00" },
          wednesday: { open: "09:00", close: "21:00" },
          thursday: { open: "09:00", close: "21:00" },
          friday: { open: "09:00", close: "21:00" },
          saturday: { open: "09:00", close: "18:00" },
          sunday: { open: "10:00", close: "17:00" },
        },
        services: [
          {
            name: "prescription_filling",
            description: "Professional prescription filling services",
            available: true,
          },
          {
            name: "consultation",
            description: "Medication counseling and consultation",
            available: true,
          },
          {
            name: "home_delivery",
            description: "Home delivery services",
            available: true,
          },
        ],
        isVerified: true,
        isActive: true,
      });

      await pharmacy.save();
      console.log(
        `✅ Created pharmacy: ${pharmacy.pharmacyName} (${pharmacy._id})`
      );
    } else {
      console.log("User not found!");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

createPharmacyRecord();
