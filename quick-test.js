import mongoose from "mongoose";

async function quickNotificationTest() {
  try {
    console.log("🔗 Connecting to MongoDB...");
    await mongoose.connect(
      "mongodb+srv://mondalsubarna29:Su12345@cluster0.1kmazke.mongodb.net/doctor"
    );
    console.log("✅ Connected to MongoDB\n");

    // Import models
    const User = (await import("./models/User.js")).default;
    const AdvancedNotification = (
      await import("./models/AdvancedNotification.js")
    ).default;

    // Get a test user
    const testUser = await User.findOne({ role: "patient" });
    if (!testUser) {
      console.log("❌ No patient user found");
      return;
    }

    console.log(`👤 Testing with user: ${testUser.email} (${testUser.role})\n`);

    // Create a test notification
    console.log("🔔 Creating test notification...");
    const notification = new AdvancedNotification({
      title: "Quick Test Notification",
      message: "Testing notification system",
      type: "system_alert",
      priority: "medium",
      recipients: [
        {
          userId: testUser._id,
          userRole: testUser.role,
          deliveryStatus: "pending",
        },
      ],
      channels: { inApp: { enabled: true } },
      createdBy: { isSystem: true },
      status: "active",
    });

    await notification.save();
    console.log(`✅ Created notification: ${notification._id}\n`);

    // Try to retrieve it
    console.log("📥 Retrieving notifications...");
    const userNotifications = await AdvancedNotification.find({
      "recipients.userId": testUser._id,
      status: "active",
    });

    console.log(`📧 Found ${userNotifications.length} notifications for user`);
    userNotifications.forEach((notif) => {
      console.log(`   - "${notif.title}" (${notif.type})`);
    });

    console.log("\n✅ Notification system is working!");
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    mongoose.connection.close();
  }
}

quickNotificationTest();
