import mongoose from "mongoose";
import RefillRequest from "./controllers/refillController.js";
import { Order } from "./models/Order.js";
import dotenv from "dotenv";

dotenv.config();

const checkRefillRequests = async () => {
  try {
    console.log("🔍 Checking refill requests in database...");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Get all refill requests
    const allRefillRequests = await RefillRequest.find({})
      .populate("originalOrderId", "orderNumber status")
      .populate("patientId", "firstName lastName email")
      .populate("pharmacyId", "pharmacyName")
      .sort({ createdAt: -1 });

    console.log("\n📊 REFILL REQUESTS SUMMARY:");
    console.log(`Total refill requests: ${allRefillRequests.length}`);

    // Group by status
    const byStatus = allRefillRequests.reduce((acc, req) => {
      acc[req.status] = (acc[req.status] || 0) + 1;
      return acc;
    }, {});

    console.log("Status breakdown:", byStatus);

    // Check for duplicates (same order ID with pending status)
    const pendingRequests = allRefillRequests.filter(
      (req) => req.status === "pending"
    );
    const orderIdCounts = pendingRequests.reduce((acc, req) => {
      const orderId = req.originalOrderId?._id?.toString();
      if (orderId) {
        acc[orderId] = (acc[orderId] || 0) + 1;
      }
      return acc;
    }, {});

    const duplicates = Object.entries(orderIdCounts).filter(
      ([_, count]) => count > 1
    );

    if (duplicates.length > 0) {
      console.log("\n⚠️ DUPLICATE PENDING REQUESTS FOUND:");
      for (const [orderId, count] of duplicates) {
        console.log(`Order ${orderId}: ${count} pending refill requests`);
      }
    } else {
      console.log("\n✅ No duplicate pending requests found");
    }

    // Show recent refill requests
    console.log("\n📋 RECENT REFILL REQUESTS:");
    allRefillRequests.slice(0, 10).forEach((req, index) => {
      console.log(
        `${index + 1}. ${req.patientId?.firstName} ${req.patientId?.lastName}`
      );
      console.log(
        `   Order: ${
          req.originalOrderId?.orderNumber || req.originalOrderId?._id
        }`
      );
      console.log(`   Status: ${req.status}`);
      console.log(`   Pharmacy: ${req.pharmacyId?.pharmacyName}`);
      console.log(`   Created: ${req.createdAt}`);
      console.log("   ---");
    });

    // Check order statuses for pending refill requests
    console.log("\n🔍 CHECKING ORDER STATUSES FOR PENDING REFILLS:");
    for (const req of pendingRequests.slice(0, 5)) {
      if (req.originalOrderId) {
        console.log(`Refill ${req._id}:`);
        console.log(`  Order Status: ${req.originalOrderId.status}`);
        console.log(
          `  Allowed: ${["delivered", "completed"].includes(
            req.originalOrderId.status
          )}`
        );
      }
    }
  } catch (error) {
    console.error("❌ Error checking refill requests:", error);
  } finally {
    await mongoose.connection.close();
    console.log("\n🔌 Database connection closed");
  }
};

checkRefillRequests();
