import mongoose from "mongoose";
import User from "./models/User.js";
import Pharmacy from "./models/Pharmacy.js";
import { Order } from "./models/Order.js";
import dotenv from "dotenv";

dotenv.config();

async function verifyPharmacySetup() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const userId = "68874bcc5876e99b435758a7";

    // Check user
    const user = await User.findById(userId);
    console.log(`\n📋 USER INFO:`);
    console.log(`User: ${user.email} (role: ${user.role})`);

    // Check pharmacy
    const pharmacy = await Pharmacy.findOne({ userId });
    console.log(`\n🏥 PHARMACY INFO:`);
    if (pharmacy) {
      console.log(`✅ Pharmacy: ${pharmacy.pharmacyName} (${pharmacy._id})`);
      console.log(`   License: ${pharmacy.licenseNumber}`);
      console.log(`   Verified: ${pharmacy.isVerified}`);
    } else {
      console.log("❌ No pharmacy found");
    }

    // Check orders for this pharmacy
    console.log(`\n📦 ORDERS FOR THIS PHARMACY:`);
    if (pharmacy) {
      const orders = await Order.find({ pharmacyId: pharmacy._id }).populate(
        "patientId",
        "firstName lastName email"
      );
      console.log(`Total orders: ${orders.length}`);

      orders.forEach((order, index) => {
        console.log(
          `${index + 1}. Order ${order._id} - Status: ${
            order.status
          } - Patient: ${order.patientId?.firstName} ${
            order.patientId?.lastName
          }`
        );
      });
    }

    // Check all orders in database
    console.log(`\n📦 ALL ORDERS IN DATABASE:`);
    const allOrders = await Order.find({}).populate(
      "patientId",
      "firstName lastName email"
    );
    console.log(`Total orders in database: ${allOrders.length}`);

    const ordersByPharmacy = {};
    allOrders.forEach((order) => {
      const pharmacyId = order.pharmacyId?.toString();
      if (!ordersByPharmacy[pharmacyId]) {
        ordersByPharmacy[pharmacyId] = 0;
      }
      ordersByPharmacy[pharmacyId]++;
    });

    console.log("Orders by pharmacy:");
    for (const [pharmacyId, count] of Object.entries(ordersByPharmacy)) {
      const pharmacyInfo = await Pharmacy.findById(pharmacyId);
      console.log(
        `  ${
          pharmacyInfo?.pharmacyName || "Unknown"
        } (${pharmacyId}): ${count} orders`
      );
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

verifyPharmacySetup();
