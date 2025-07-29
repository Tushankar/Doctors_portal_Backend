import mongoose from "mongoose";
import dotenv from "dotenv";
import AdvancedNotification from "./models/AdvancedNotification.js";
import User from "./models/User.js";

// Load environment variables
dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected for creating simple notifications");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    process.exit(1);
  }
};

// Create simple notifications without spatial data
const createSimpleNotifications = async () => {
  try {
    console.log("🔔 Creating simple notifications (no spatial data)...");

    // Get first 10 users to avoid overwhelming
    const users = await User.find({}).limit(10);
    console.log(`👥 Found ${users.length} users`);

    if (users.length === 0) {
      console.log("❌ No users found! Cannot create notifications.");
      return;
    }

    const notificationTemplates = [
      {
        title: "Welcome! 👋",
        message:
          "Welcome to the Medical Portal! Your health journey starts here.",
        type: "system_alert",
        priority: "medium",
      },
      {
        title: "Important Update 📢",
        message: "New features have been added to improve your experience.",
        type: "system_alert",
        priority: "high",
      },
      {
        title: "Health Reminder 💊",
        message:
          "Remember to take care of your health and follow your treatment plan.",
        type: "appointment",
        priority: "medium",
      },
    ];

    let notificationCount = 0;

    // Create one notification for each user
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const template = notificationTemplates[i % notificationTemplates.length];

      try {
        // Create minimal notification object
        const notificationData = {
          title: template.title,
          message: `${template.message} (For ${user.email})`,
          type: template.type,
          priority: template.priority,
          recipients: [
            {
              userId: user._id,
              userRole: user.role,
              deliveryStatus: "pending",
            },
          ],
          targeting: {
            roles: [user.role],
          },
          createdBy: {
            userId: user._id,
            userRole: "system",
            isSystem: true,
          },
          status: "active",
        };

        const notification = new AdvancedNotification(notificationData);
        const saved = await notification.save();

        console.log(
          `✅ Created notification for ${user.role}: ${user.email} - ${template.title}`
        );
        notificationCount++;
      } catch (saveError) {
        console.error(
          `❌ Failed to create notification for ${user.email}:`,
          saveError.message
        );
      }
    }

    console.log(
      `\n🎉 Successfully created ${notificationCount} notifications!`
    );
    return notificationCount;
  } catch (error) {
    console.error("❌ Error creating notifications:", error);
    throw error;
  }
};

// Main function
const createNotifications = async () => {
  console.log("🚀 Starting simple notification creation script...\n");

  await connectDB();

  try {
    const total = await createSimpleNotifications();

    // Verify creation
    const totalInDB = await AdvancedNotification.countDocuments({});
    console.log(`\n📊 Total notifications now in database: ${totalInDB}`);

    // Show sample notifications
    const sampleNotifications = await AdvancedNotification.find({})
      .populate("recipients.userId", "email role")
      .limit(3);

    console.log(`\n📋 Sample notifications:`);
    sampleNotifications.forEach((notification, index) => {
      const recipient = notification.recipients[0];
      console.log(
        `  ${index + 1}. "${notification.title}" for ${
          recipient.userId?.email
        } (${recipient.userRole})`
      );
    });

    console.log(`\n✅ Script completed successfully!`);
    console.log(
      `🔗 Users should now be able to see notifications in the frontend!`
    );
  } catch (error) {
    console.error("❌ Script failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
    process.exit(0);
  }
};

createNotifications();
