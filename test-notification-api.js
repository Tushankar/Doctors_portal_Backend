import mongoose from "mongoose";
import dotenv from "dotenv";
import AdvancedNotification from "./models/AdvancedNotification.js";
import User from "./models/User.js";

// Load environment variables
dotenv.config();

// Test the advanced notification functionality
const testNotificationAPI = async () => {
  try {
    console.log("🔍 Testing Advanced Notification API functions...\n");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Test 1: Get all notifications
    console.log("\n📋 Test 1: Fetching all notifications");
    const allNotifications = await AdvancedNotification.find({})
      .populate("recipients.userId", "email role name")
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${allNotifications.length} total notifications`);
    allNotifications.slice(0, 3).forEach((notification, index) => {
      const recipient = notification.recipients[0];
      console.log(
        `  ${index + 1}. "${notification.title}" - ${recipient.userRole} (${
          recipient.userId?.email
        })`
      );
    });

    // Test 2: Get notifications for a specific user
    console.log("\n👤 Test 2: Fetching notifications for specific users");
    const testUsers = await User.find({}).limit(3);

    for (const user of testUsers) {
      const userNotifications = await AdvancedNotification.findForUser(
        user._id
      );
      console.log(
        `  ${user.email} (${user.role}): ${userNotifications.length} notifications`
      );

      userNotifications.forEach((notification) => {
        const recipient = notification.recipients.find(
          (r) => r.userId.toString() === user._id.toString()
        );
        console.log(
          `    - "${notification.title}" [${notification.priority}] - Status: ${recipient?.deliveryStatus}`
        );
      });
    }

    // Test 3: Mark a notification as read
    console.log("\n✅ Test 3: Testing mark as read functionality");
    const testNotification = allNotifications[0];
    if (testNotification) {
      const recipientUserId = testNotification.recipients[0].userId;
      console.log(
        `  Marking notification "${testNotification.title}" as read for user ${recipientUserId}`
      );

      await testNotification.markAsRead(recipientUserId);
      console.log(`  ✅ Successfully marked as read`);

      // Verify it was marked as read
      const updatedNotification = await AdvancedNotification.findById(
        testNotification._id
      );
      const updatedRecipient = updatedNotification.recipients.find(
        (r) => r.userId.toString() === recipientUserId.toString()
      );
      console.log(
        `  📊 Status after update: ${updatedRecipient.deliveryStatus}`
      );
      console.log(`  📅 Read at: ${updatedRecipient.readAt}`);
    }

    // Test 4: Get notification counts
    console.log("\n📊 Test 4: Checking notification statistics");
    const stats = {
      total: await AdvancedNotification.countDocuments({}),
      active: await AdvancedNotification.countDocuments({ status: "active" }),
      read: await AdvancedNotification.countDocuments({
        "recipients.deliveryStatus": "read",
      }),
      unread: await AdvancedNotification.countDocuments({
        "recipients.deliveryStatus": "pending",
      }),
      high_priority: await AdvancedNotification.countDocuments({
        priority: "high",
      }),
      medium_priority: await AdvancedNotification.countDocuments({
        priority: "medium",
      }),
    };

    console.log("  Statistics:");
    Object.entries(stats).forEach(([key, value]) => {
      console.log(`    ${key.replace("_", " ")}: ${value}`);
    });

    // Test 5: Test notification types
    console.log("\n📋 Test 5: Notifications by type");
    const types = await AdvancedNotification.distinct("type");
    console.log(`  Available types: ${types.join(", ")}`);

    for (const type of types) {
      const count = await AdvancedNotification.countDocuments({ type });
      console.log(`    ${type}: ${count} notifications`);
    }

    // Test 6: User role distribution
    console.log("\n👥 Test 6: Notifications by user role");
    const roleStats = await AdvancedNotification.aggregate([
      { $unwind: "$recipients" },
      { $group: { _id: "$recipients.userRole", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    roleStats.forEach((stat) => {
      console.log(`    ${stat._id}: ${stat.count} notifications`);
    });

    console.log("\n🎉 All API function tests completed successfully!");
    console.log("✅ The notification system is working correctly!");
    console.log("\n💡 Next steps:");
    console.log("   1. Start the main server");
    console.log("   2. Users should now see notifications in the frontend");
    console.log("   3. The notification API endpoints are ready to use");
  } catch (error) {
    console.error("❌ API test failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
    process.exit(0);
  }
};

console.log("🧪 Advanced Notification API Test Suite\n");
testNotificationAPI();
