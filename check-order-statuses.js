import mongoose from "mongoose";
import { Order } from "./models/Order.js";
import User from "./models/User.js"; // Import User model for populate
import Patient from "./models/Patient.js"; // Import Patient model for discriminator
import dotenv from "dotenv";

dotenv.config();

const checkOrderStatuses = async () => {
  try {
    console.log("🔍 Checking order statuses in database...");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Get all orders with their statuses
    const orders = await Order.find({})
      .select("orderNumber status patientId createdAt")
      .populate("patientId", "firstName lastName")
      .sort({ createdAt: -1 })
      .limit(20); // Get last 20 orders

    console.log(`\n📊 Found ${orders.length} orders (showing last 20):`);

    // Count orders by status
    const statusCounts = await Order.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    console.log("\n📈 ORDER STATUS SUMMARY:");
    statusCounts.forEach((item) => {
      console.log(`${item._id}: ${item.count} orders`);
    });

    console.log("\n📋 RECENT ORDERS WITH STATUSES:");
    orders.forEach((order, index) => {
      const eligibleForRefill = ["delivered", "completed"].includes(
        order.status
      );
      console.log(`${index + 1}. Order: ${order.orderNumber || order._id}`);
      console.log(
        `   Patient: ${order.patientId?.firstName} ${order.patientId?.lastName}`
      );
      console.log(
        `   Status: "${order.status}" ${
          eligibleForRefill ? "✅ (Refill Eligible)" : "❌ (Not Eligible)"
        }`
      );
      console.log(`   Created: ${order.createdAt}`);
      console.log("   ---");
    });

    // Check if there are any orders with unexpected status values
    const allStatuses = await Order.distinct("status");
    console.log("\n🏷️ ALL STATUS VALUES IN DATABASE:");
    allStatuses.forEach((status) => {
      const eligibleForRefill = ["delivered", "completed"].includes(status);
      console.log(`"${status}" ${eligibleForRefill ? "✅" : "❌"}`);
    });
  } catch (error) {
    console.error("❌ Error checking order statuses:", error);
  } finally {
    await mongoose.connection.close();
    console.log("\n🔌 Database connection closed");
  }
};

checkOrderStatuses();
