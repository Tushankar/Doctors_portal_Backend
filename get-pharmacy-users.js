import dotenv from "dotenv";
import connectDB from "./config/db.js";
import User from "./models/User.js";

dotenv.config();

async function getPharmacyUsers() {
  try {
    await connectDB();

    const pharmacyUsers = await User.find({ role: "pharmacy" }).select(
      "email role isActive"
    );
    console.log("Available pharmacy users:");
    pharmacyUsers.forEach((user, index) => {
      console.log(`${index + 1}. Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Active: ${user.isActive}`);
      console.log(`   ID: ${user._id}`);
      console.log("");
    });

    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

getPharmacyUsers();
