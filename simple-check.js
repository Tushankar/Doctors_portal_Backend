import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const checkNotifications = async () => {
  try {
    console.log("🔍 Simple Notification Check...\n");

    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Direct query to check notifications
    const notifications = await mongoose.connection.db
      .collection("advancednotifications")
      .find({ type: "order_status" })
      .sort({ createdAt: -1 })
      .toArray();

    console.log(`📊 Found ${notifications.length} order status notifications:`);

    notifications.forEach((notification, index) => {
      console.log(`\n${index + 1}. ${notification.title}`);
      console.log(`   Message: ${notification.message}`);
      console.log(`   Priority: ${notification.priority}`);
      console.log(`   Recipients: ${notification.recipients?.length || 0}`);
      console.log(`   Created: ${notification.createdAt}`);
      console.log(`   Reference: ${notification.referenceData?.referenceType}`);
    });

    // Check total notifications by type
    const allNotifications = await mongoose.connection.db
      .collection("advancednotifications")
      .find({})
      .toArray();

    const byType = {};
    allNotifications.forEach((n) => {
      byType[n.type] = (byType[n.type] || 0) + 1;
    });

    console.log(`\n📋 Notifications by type:`);
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
    process.exit(0);
  }
};

checkNotifications();
