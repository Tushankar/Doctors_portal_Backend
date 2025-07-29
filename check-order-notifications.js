import mongoose from "mongoose";
import dotenv from "dotenv";
import AdvancedNotification from "./models/AdvancedNotification.js";

// Load environment variables
dotenv.config();

const checkOrderNotifications = async () => {
  try {
    console.log("🔍 Checking Order Status Notifications...\n");

    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Get all order status notifications
    const orderNotifications = await AdvancedNotification.find({
      type: "order_status",
    })
      .populate("recipients.userId", "email firstName lastName")
      .sort({ createdAt: -1 });

    console.log(
      `\n📊 Found ${orderNotifications.length} order status notifications:`
    );

    orderNotifications.forEach((notification, index) => {
      const recipient = notification.recipients[0];
      console.log(`\n${index + 1}. ${notification.title}`);
      console.log(`   Message: ${notification.message}`);
      console.log(`   Priority: ${notification.priority}`);
      console.log(
        `   Patient: ${recipient.userId?.email} (${recipient.userId?.firstName} ${recipient.userId?.lastName})`
      );
      console.log(`   Status: ${recipient.deliveryStatus}`);
      console.log(`   Created: ${notification.createdAt}`);

      if (notification.referenceData?.metadata) {
        console.log(
          `   Order Number: ${notification.referenceData.metadata.orderNumber}`
        );
        console.log(
          `   Order Status: ${notification.referenceData.metadata.status}`
        );
        console.log(
          `   Pharmacy: ${notification.referenceData.metadata.pharmacyName}`
        );
        if (notification.referenceData.metadata.notes) {
          console.log(`   Notes: ${notification.referenceData.metadata.notes}`);
        }
      }
    });

    // Check for any recent notifications (last hour)
    const recentNotifications = await AdvancedNotification.find({
      type: "order_status",
      createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
    });

    console.log(
      `\n⏰ Recent notifications (last hour): ${recentNotifications.length}`
    );

    if (recentNotifications.length > 0) {
      console.log(
        "🎉 SUCCESS! Order status notifications are being created when pharmacies update order status!"
      );
    } else {
      console.log(
        "⚠️  No recent order status notifications found. The system may need testing."
      );
    }
  } catch (error) {
    console.error("❌ Error checking notifications:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
    process.exit(0);
  }
};

console.log("🔔 Order Status Notification Checker\n");
checkOrderNotifications();
