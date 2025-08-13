import mongoose from "mongoose";
import RefillRequest from "./controllers/refillController.js";
import { createRefillResponseNotification } from "./utils/refillNotifications.js";

// Test the refill notification system
async function testRefillNotifications() {
  try {
    console.log("🧪 Testing Refill Notification System...");

    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/doctorportal"
    );
    console.log("✅ Connected to MongoDB");

    // Find a sample refill request to test with
    const sampleRefillRequest = await RefillRequest.findOne({
      status: "pending",
    })
      .populate("patientId", "firstName lastName email")
      .populate("pharmacyId", "pharmacyName email userId")
      .populate("originalOrderId")
      .populate("prescriptionId");

    if (!sampleRefillRequest) {
      console.log("❌ No pending refill requests found for testing");
      return;
    }

    console.log("✅ Found test refill request:", sampleRefillRequest._id);
    console.log(
      "Patient:",
      sampleRefillRequest.patientId?.firstName,
      sampleRefillRequest.patientId?.lastName
    );
    console.log("Pharmacy:", sampleRefillRequest.pharmacyId?.pharmacyName);

    // Test creating approval notification
    console.log("\n📢 Testing approval notification...");
    try {
      const approvalNotification = await createRefillResponseNotification(
        sampleRefillRequest,
        "approved",
        "Test approval message"
      );
      console.log(
        "✅ Approval notification created:",
        approvalNotification._id
      );
    } catch (error) {
      console.error("❌ Approval notification failed:", error.message);
    }

    // Test creating rejection notification
    console.log("\n📢 Testing rejection notification...");
    try {
      const rejectionNotification = await createRefillResponseNotification(
        sampleRefillRequest,
        "rejected",
        "Test rejection message"
      );
      console.log(
        "✅ Rejection notification created:",
        rejectionNotification._id
      );
    } catch (error) {
      console.error("❌ Rejection notification failed:", error.message);
    }

    console.log("\n🎉 Notification test completed!");
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("📡 Disconnected from MongoDB");
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testRefillNotifications();
}

export default testRefillNotifications;
