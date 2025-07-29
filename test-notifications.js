import mongoose from "mongoose";
import AdvancedNotification from "./models/AdvancedNotification.js";
import Patient from "./models/Patient.js";
import { User } from "./models/User.js";

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect("mongodb://localhost:27017/doctor_portal");
    console.log("✅ MongoDB connected for notification testing");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    process.exit(1);
  }
};

// Test creating notifications
const testCreateNotifications = async () => {
  try {
    console.log("🔔 Testing notification creation...");

    // Get some test users
    const users = await User.find().limit(5);
    if (users.length === 0) {
      console.log("❌ No users found in database");
      return;
    }

    console.log(`📊 Found ${users.length} users to test with`);

    // Create test notifications for each user
    for (let i = 0; i < users.length; i++) {
      const user = users[i];

      const testNotification = new AdvancedNotification({
        title: `Test Notification ${i + 1}`,
        message: `This is a test notification for ${
          user.name || user.email
        }. Created at ${new Date().toLocaleString()}`,
        type: "system_alert",
        priority: i % 2 === 0 ? "medium" : "high",
        recipients: [
          {
            userId: user._id,
            userRole: user.role,
            deliveryStatus: "pending",
          },
        ],
        spatial: {
          enabled: false,
        },
        targeting: {
          roles: [user.role],
        },
        createdBy: {
          userId: user._id,
          userRole: "system",
          isSystem: true,
        },
        status: "active",
      });

      const saved = await testNotification.save();
      console.log(
        `✅ Created notification for ${user.role}: ${user.email} - ID: ${saved._id}`
      );
    }

    console.log("🎉 All test notifications created successfully!");
  } catch (error) {
    console.error("❌ Error creating test notifications:", error);
  }
};

// Test retrieving notifications
const testRetrieveNotifications = async () => {
  try {
    console.log("\n🔍 Testing notification retrieval...");

    // Get all notifications
    const allNotifications = await AdvancedNotification.find({});
    console.log(
      `📊 Total notifications in database: ${allNotifications.length}`
    );

    // Get notifications by user
    const users = await User.find().limit(3);
    for (const user of users) {
      const userNotifications = await AdvancedNotification.findForUser(
        user._id
      );
      console.log(
        `👤 ${user.email} (${user.role}): ${userNotifications.length} notifications`
      );

      if (userNotifications.length > 0) {
        userNotifications.forEach((notification) => {
          const recipient = notification.recipients.find(
            (r) => r.userId.toString() === user._id.toString()
          );
          console.log(
            `  - ${notification.title} [${notification.priority}] - Status: ${
              recipient?.deliveryStatus || "unknown"
            }`
          );
        });
      }
    }
  } catch (error) {
    console.error("❌ Error retrieving notifications:", error);
  }
};

// Test marking notifications as read
const testMarkAsRead = async () => {
  try {
    console.log("\n✅ Testing mark as read functionality...");

    const notifications = await AdvancedNotification.find({}).limit(2);

    for (const notification of notifications) {
      if (notification.recipients.length > 0) {
        const recipient = notification.recipients[0];
        await notification.markAsRead(recipient.userId);
        console.log(
          `✅ Marked notification "${notification.title}" as read for user ${recipient.userId}`
        );
      }
    }
  } catch (error) {
    console.error("❌ Error marking notifications as read:", error);
  }
};

// Main test function
const runTests = async () => {
  await connectDB();

  console.log("🧪 Starting Advanced Notification System Tests\n");

  await testCreateNotifications();
  await testRetrieveNotifications();
  await testMarkAsRead();

  console.log("\n🏁 Notification tests completed!");

  // Final stats
  const totalNotifications = await AdvancedNotification.countDocuments({});
  const activeNotifications = await AdvancedNotification.countDocuments({
    status: "active",
  });
  const readNotifications = await AdvancedNotification.countDocuments({
    "recipients.deliveryStatus": "read",
  });

  console.log(`\n📈 Final Statistics:`);
  console.log(`  Total notifications: ${totalNotifications}`);
  console.log(`  Active notifications: ${activeNotifications}`);
  console.log(`  Read notifications: ${readNotifications}`);

  process.exit(0);
};

runTests().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
