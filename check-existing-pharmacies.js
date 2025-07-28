import mongoose from "mongoose";
import User from "./models/User.js";
import Pharmacy from "./models/Pharmacy.js";
import { Order } from "./models/Order.js";
import dotenv from "dotenv";

dotenv.config();

async function checkExistingPharmacies() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Get all pharmacies
    const pharmacies = await Pharmacy.find({}).populate(
      "userId",
      "email firstName lastName role"
    );

    console.log("\n🏥 ALL PHARMACIES IN DATABASE:");
    for (const pharmacy of pharmacies) {
      console.log(`\n📍 ${pharmacy.pharmacyName} (${pharmacy._id})`);
      console.log(`   License: ${pharmacy.licenseNumber}`);
      console.log(
        `   User: ${pharmacy.userId?.email || "No user"} (${
          pharmacy.userId?.role || "No role"
        })`
      );
      console.log(`   User ID: ${pharmacy.userId?._id || "No userId"}`);

      // Count orders for this pharmacy
      const orderCount = await Order.countDocuments({
        pharmacyId: pharmacy._id,
      });
      console.log(`   Orders: ${orderCount}`);

      if (orderCount > 0) {
        const orders = await Order.find({ pharmacyId: pharmacy._id }).limit(2);
        console.log(`   Sample orders: ${orders.map((o) => o._id).join(", ")}`);
      }
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

checkExistingPharmacies();
