import mongoose from "mongoose";
import User from "./models/User.js";
import dotenv from "dotenv";

dotenv.config();

async function fixUserRole() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const userId = "68874bcc5876e99b435758a7";
    const user = await User.findById(userId);

    if (user) {
      console.log(`Current user: ${user.email} (role: ${user.role})`);

      // Update role to pharmacy
      user.role = "pharmacy";
      await user.save();

      console.log(`✅ Updated user role to: ${user.role}`);
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

fixUserRole();
