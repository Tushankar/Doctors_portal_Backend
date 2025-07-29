import mongoose from "mongoose";
import AdvancedNotification from "./models/AdvancedNotification.js";
import User from "./models/User.js";

async function quickNotificationTest() {
  try {
    // Connect to MongoDB using the actual URI
    await mongoose.connect(
      "mongodb+srv://mondalsubarna29:Su12345@cluster0.1kmazke.mongodb.net/doctor"
    );
    console.log("🔗 Connected to MongoDB");

    // Check notifications
    const notifications = await AdvancedNotification.find({}).limit(5);
    console.log(`📊 Found ${notifications.length} notifications:`);

    notifications.forEach((notif, index) => {
      console.log(
        `   ${index + 1}. "${notif.title}" - ${notif.type} (recipients: ${
          notif.recipients?.length || 0
        })`
      );
    });

    // Check users
    const users = await User.find({}).limit(3);
    console.log(`\n👥 Found ${users.length} users:`);
    users.forEach((user) => {
      console.log(`   - ${user.username} (${user.role})`);
    });

    // Test notification query for first user
    if (users.length > 0) {
      const userNotifications = await AdvancedNotification.find({
        "recipients.userId": users[0]._id,
        status: "active",
      });
      console.log(
        `\n📧 User ${users[0].username} has ${userNotifications.length} notifications`
      );

      // Test admin query (all notifications)
      const allNotifications = await AdvancedNotification.find({
        status: "active",
      });
      console.log(
        `📧 Admin view: ${allNotifications.length} total active notifications`
      );
    }

    console.log("\n✅ Quick test completed!");
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    mongoose.connection.close();
  }
}

quickNotificationTest();
