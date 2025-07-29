import mongoose from "mongoose";
import dotenv from "dotenv";
import { Order } from "./models/Order.js";
import Pharmacy from "./models/Pharmacy.js";
import AdvancedNotification from "./models/AdvancedNotification.js";
import { orderController } from "./controllers/orderController.js";

// Load environment variables
dotenv.config();

// Test order status update with notification creation
const testOrderStatusUpdate = async () => {
  try {
    console.log("🧪 Testing Order Status Update with Notifications...\n");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Get a pharmacy user
    const pharmacy = await Pharmacy.findOne({}).populate("userId");
    if (!pharmacy) {
      console.log("❌ No pharmacy found in database");
      return;
    }

    console.log(
      `🏥 Found pharmacy: ${pharmacy.pharmacyName} (User: ${pharmacy.userId?._id})`
    );

    // Find an order for this pharmacy
    const order = await Order.findOne({
      pharmacyId: pharmacy._id,
      status: { $in: ["pending", "processing", "confirmed"] },
    }).populate(["patientId", "prescriptionId", "pharmacyId"]);

    if (!order) {
      console.log("❌ No suitable order found for testing");
      console.log("💡 Creating a test scenario...");

      // Get all orders for this pharmacy
      const allOrders = await Order.find({ pharmacyId: pharmacy._id });
      console.log(
        `📊 Found ${allOrders.length} total orders for this pharmacy`
      );

      if (allOrders.length > 0) {
        const testOrder = allOrders[0];
        console.log(
          `🎯 Using order: ${testOrder.orderNumber} (current status: ${testOrder.status})`
        );

        // Test updating to a different status
        const newStatus =
          testOrder.status === "delivered" ? "preparing" : "ready";
        console.log(
          `🔄 Testing status update from '${testOrder.status}' to '${newStatus}'`
        );

        await testStatusUpdate(testOrder._id, newStatus, pharmacy.userId._id);
        return;
      }
    }

    if (order) {
      console.log(
        `📦 Found order: ${order.orderNumber} (Status: ${order.status})`
      );
      console.log(
        `👤 Patient: ${order.patientId?.firstName} ${order.patientId?.lastName}`
      );

      // Test status update
      const newStatus = getNextStatus(order.status);
      console.log(
        `🔄 Updating status from '${order.status}' to '${newStatus}'`
      );

      await testStatusUpdate(order._id, newStatus, pharmacy.userId._id);
    }
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
    process.exit(0);
  }
};

// Helper function to determine next status
const getNextStatus = (currentStatus) => {
  const statusFlow = {
    pending: "processing",
    processing: "confirmed",
    confirmed: "preparing",
    preparing: "ready",
    ready: "dispatched",
    dispatched: "delivered",
  };

  return statusFlow[currentStatus] || "ready";
};

// Test the actual status update
const testStatusUpdate = async (orderId, newStatus, userId) => {
  try {
    console.log(`\n🔄 Starting status update test...`);

    // Count notifications before update
    const notificationsBefore = await AdvancedNotification.countDocuments({
      type: "order_status",
    });
    console.log(
      `📊 Order status notifications before update: ${notificationsBefore}`
    );

    // Create controller instance and update status
    const result = await orderController.updateOrderStatus(
      orderId,
      newStatus,
      userId,
      "Test status update - automated notification test"
    );

    console.log(`✅ Order status updated successfully:`);
    console.log(`   Order: ${result.data.orderNumber}`);
    console.log(`   New Status: ${result.data.status}`);
    console.log(`   Patient: ${result.data.patientId?.email}`);

    // Count notifications after update
    const notificationsAfter = await AdvancedNotification.countDocuments({
      type: "order_status",
    });
    console.log(
      `📊 Order status notifications after update: ${notificationsAfter}`
    );

    if (notificationsAfter > notificationsBefore) {
      console.log(
        `🎉 SUCCESS! New notification was created (+${
          notificationsAfter - notificationsBefore
        })`
      );

      // Show the latest notification
      const latestNotification = await AdvancedNotification.findOne({
        type: "order_status",
      })
        .sort({ createdAt: -1 })
        .populate("recipients.userId", "email");

      if (latestNotification) {
        console.log(`\n📋 Latest notification created:`);
        console.log(`   Title: ${latestNotification.title}`);
        console.log(`   Message: ${latestNotification.message}`);
        console.log(`   Priority: ${latestNotification.priority}`);
        console.log(
          `   Recipient: ${latestNotification.recipients[0]?.userId?.email}`
        );
        console.log(
          `   Status: ${latestNotification.recipients[0]?.deliveryStatus}`
        );
      }
    } else {
      console.log(`❌ FAILED! No new notification was created`);
    }
  } catch (error) {
    console.error("❌ Status update test failed:", error);
  }
};

console.log("🧪 Order Status Update Notification Test\n");
testOrderStatusUpdate();
