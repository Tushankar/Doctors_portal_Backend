import mongoose from "mongoose";
import connectDB from "./config/db.js";
import AdvancedNotification from "./models/AdvancedNotification.js";
import { getUserNotificationsWithAdminAccess } from "./controllers/advancedNotificationController.js";
import User from "./models/User.js";
import Pharmacy from "./models/Pharmacy.js";
import Patient from "./models/Patient.js";

async function testNotificationSystem() {
  try {
    await connectDB();
    console.log("🧪 Testing Notification System...\n");

    // Step 1: Check current notifications count
    const totalNotifications = await AdvancedNotification.countDocuments({});
    console.log(`📊 Total notifications in database: ${totalNotifications}`);

    // Step 2: Get test users
    const testUsers = await User.find({}).populate("userId").limit(5);
    console.log(`👥 Found ${testUsers.length} test users:`);
    testUsers.forEach((user) => {
      console.log(`   - ${user.username} (${user.role})`);
    });

    if (testUsers.length === 0) {
      console.log("❌ No users found! Cannot test notifications.");
      return;
    }

    // Step 3: Create a test notification manually
    console.log("\n🔔 Creating test notification...");
    const testNotification = new AdvancedNotification({
      title: "Test Notification",
      message: "This is a test notification to verify the system works.",
      type: "system_alert",
      priority: "medium",
      recipients: [
        {
          userId: testUsers[0]._id,
          userRole: testUsers[0].role,
          deliveryStatus: "pending",
        },
      ],
      channels: {
        inApp: { enabled: true },
      },
      createdBy: {
        isSystem: true,
      },
      status: "active",
    });

    await testNotification.save();
    console.log(
      `✅ Test notification created with ID: ${testNotification._id}`
    );

    // Step 4: Test retrieving notifications for the user
    console.log("\n📥 Testing notification retrieval...");

    // Test as regular user
    const userNotifications = await AdvancedNotification.find({
      "recipients.userId": testUsers[0]._id,
      status: "active",
    }).populate("recipients.userId", "username role");

    console.log(
      `📧 User ${testUsers[0].username} has ${userNotifications.length} notifications:`
    );
    userNotifications.forEach((notif, index) => {
      console.log(
        `   ${index + 1}. "${notif.title}" - ${notif.type} (${notif.priority})`
      );
    });

    // Step 5: Test admin view (all notifications)
    console.log("\n👑 Testing admin view...");
    const adminUser = testUsers.find((u) => u.role === "admin");
    if (adminUser) {
      const allNotifications = await AdvancedNotification.find({
        status: "active",
      })
        .populate("recipients.userId", "username role")
        .sort({ createdAt: -1 })
        .limit(10);

      console.log(`📧 Admin can see ${allNotifications.length} notifications:`);
      allNotifications.forEach((notif, index) => {
        const recipientNames = notif.recipients
          .map((r) => r.userId?.username || "Unknown")
          .join(", ");
        console.log(`   ${index + 1}. "${notif.title}" → [${recipientNames}]`);
      });
    } else {
      console.log("⚠️ No admin user found for admin testing");
    }

    // Step 6: Test the controller function
    console.log("\n🎛️ Testing getUserNotificationsWithAdminAccess function...");
    try {
      const result = await getUserNotificationsWithAdminAccess(
        testUsers[0]._id.toString(),
        {}
      );
      console.log(
        `✅ Controller returned ${result.data.length} notifications for user`
      );
    } catch (controllerError) {
      console.log(`❌ Controller error: ${controllerError.message}`);
    }

    // Step 7: Summary
    console.log("\n📋 System Status Summary:");
    console.log(
      `   Total notifications: ${await AdvancedNotification.countDocuments({})}`
    );
    console.log(
      `   Active notifications: ${await AdvancedNotification.countDocuments({
        status: "active",
      })}`
    );
    console.log(
      `   Notification types: ${await AdvancedNotification.distinct("type")}`
    );

    console.log("\n✅ Notification system test completed!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error(error.stack);
  } finally {
    mongoose.connection.close();
  }
}

// Run the test
testNotificationSystem();
