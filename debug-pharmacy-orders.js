import mongoose from "mongoose";
import Pharmacy from "./models/Pharmacy.js";
import { Order } from "./models/Order.js";
import User from "./models/User.js"; // Import User model
import dotenv from "dotenv";

dotenv.config();

async function debugPharmacyOrders() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Debug: Find all pharmacies and their users
    const pharmacies = await Pharmacy.find({}).lean();
    console.log("\n=== ALL PHARMACIES ===");
    pharmacies.forEach((pharmacy) => {
      console.log(`Pharmacy: ${pharmacy.pharmacyName}`);
      console.log(`  _id: ${pharmacy._id}`);
      console.log(`  userId: ${pharmacy.userId}`);
      console.log(`  Email: ${pharmacy.contactInfo?.email || "N/A"}`);
    });

    // Debug: Find all users with pharmacy role
    const pharmacyUsers = await User.find({ role: "pharmacy" }).lean();
    console.log("\n=== ALL PHARMACY USERS ===");
    pharmacyUsers.forEach((user) => {
      console.log(`User: ${user.email}`);
      console.log(`  _id: ${user._id}`);
      console.log(`  role: ${user.role}`);
    });

    // Debug: Find all orders without populate first
    const orders = await Order.find({}).sort({ createdAt: -1 }).lean();

    console.log(`\n=== ALL ORDERS (${orders.length} total) ===`);
    orders.forEach((order, index) => {
      console.log(`${index + 1}. Order: ${order.orderNumber || order._id}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   PharmacyId: ${order.pharmacyId}`);
      console.log(`   PatientId: ${order.patientId}`);
      console.log(`   Created: ${new Date(order.createdAt).toLocaleString()}`);
      console.log("");
    });

    // Debug specific user lookup
    const testUserId = "68874bcc5876e99b435758a7"; // From your log
    console.log(`\n=== TESTING USER LOOKUP FOR: ${testUserId} ===`);

    const user = await User.findById(testUserId);
    if (user) {
      console.log(`Found user: ${user.email} (role: ${user.role})`);
    } else {
      console.log("User not found!");
    }

    const pharmacyByUserId = await Pharmacy.findOne({ userId: testUserId });
    if (pharmacyByUserId) {
      console.log(
        `Found pharmacy by userId: ${pharmacyByUserId.pharmacyName} (${pharmacyByUserId._id})`
      );

      // Count orders for this pharmacy
      const orderCount = await Order.countDocuments({
        pharmacyId: pharmacyByUserId._id,
      });
      console.log(`Orders for this pharmacy: ${orderCount}`);
    } else {
      console.log("No pharmacy found with that userId");

      // Check if there are orphaned pharmacies
      console.log("\n=== CHECKING FOR USER-PHARMACY MISMATCHES ===");
      for (const pharmacy of pharmacies) {
        const user = await User.findById(pharmacy.userId);
        if (!user) {
          console.log(
            `❌ Pharmacy "${pharmacy.pharmacyName}" has invalid userId: ${pharmacy.userId}`
          );
        } else {
          console.log(
            `✅ Pharmacy "${pharmacy.pharmacyName}" -> User: ${user.email}`
          );
        }
      }
    }
  } catch (error) {
    console.error("Debug error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

debugPharmacyOrders();
