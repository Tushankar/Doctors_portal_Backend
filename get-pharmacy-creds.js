import dotenv from "dotenv";
import connectDB from "./config/db.js";
import Pharmacy from "./models/Pharmacy.js";

dotenv.config();

async function getPharmacyCredentials() {
  try {
    await connectDB();

    const pharmacies = await Pharmacy.find().select(
      "email pharmacyName status"
    );
    console.log("Available pharmacies:");
    pharmacies.forEach((pharmacy, index) => {
      console.log(`${index + 1}. Email: ${pharmacy.email}`);
      console.log(`   Name: ${pharmacy.pharmacyName}`);
      console.log(`   Status: ${pharmacy.status}`);
      console.log(`   ID: ${pharmacy._id}`);
      console.log("");
    });

    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

getPharmacyCredentials();
