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
    console.log("✅ MongoDB connected for creating notifications");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    process.exit(1);
  }
};

// Create sample notifications for all users
const createSampleNotifications = async () => {
  try {
    console.log("🔔 Creating sample notifications...");

    // Get all users
    const users = await User.find({});
    console.log(`👥 Found ${users.length} users`);

    if (users.length === 0) {
      console.log("❌ No users found! Cannot create notifications.");
      return;
    }

    const notificationTypes = [
      {
        title: "Welcome to the Medical Portal! 🏥",
        message:
          "Thank you for joining our medical portal. Explore the features and stay connected with healthcare services.",
        type: "system_alert",
        priority: "medium",
      },
      {
        title: "New Feature: Advanced Notifications 🔔",
        message:
          "We've introduced an advanced notification system with location-based alerts and priority settings.",
        type: "system_alert",
        priority: "high",
      },
      {
        title: "Health Reminder 💊",
        message:
          "Don't forget to take your medications and stay healthy. Regular check-ups are important.",
        type: "appointment",
        priority: "medium",
      },
      {
        title: "Security Alert 🔒",
        message:
          "Your account security is important. Enable two-factor authentication for better protection.",
        type: "security_alert",
        priority: "high",
      },
      {
        title: "System Maintenance Notice ⚙️",
        message:
          "Scheduled maintenance on Sunday, 2:00 AM - 4:00 AM. Some features may be temporarily unavailable.",
        type: "system_alert",
        priority: "low",
      },
    ];

    const createdNotifications = [];

    // Create notifications for each user
    for (let i = 0; i < users.length; i++) {
      const user = users[i];

      // Create 2-3 notifications per user
      const userNotificationCount = Math.min(3, notificationTypes.length);

      for (let j = 0; j < userNotificationCount; j++) {
        const notificationTemplate = notificationTypes[j];

        const notification = new AdvancedNotification({
          title: notificationTemplate.title,
          message: `${notificationTemplate.message} (Created for ${
            user.name || user.email
          })`,
          type: notificationTemplate.type,
          priority: notificationTemplate.priority,
          recipients: [
            {
              userId: user._id,
              userRole: user.role,
              deliveryStatus: "pending",
            },
          ],
          spatial: {
            enabled: false,
            // Don't include targetLocation if spatial is disabled
          },
          targeting: {
            roles: [user.role],
          },
          referenceData: {
            referenceType: "general",
          },
          scheduling: {
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          },
          channels: {
            inApp: { enabled: true, delivered: false },
            email: { enabled: false },
            sms: { enabled: false },
            push: { enabled: false },
          },
          content: {
            tags: ["welcome", "system", "general"],
          },
          createdBy: {
            userId: user._id,
            userRole: "system",
            isSystem: true,
          },
          status: "active",
        });

        const savedNotification = await notification.save();
        createdNotifications.push(savedNotification);

        console.log(
          `✅ Created notification "${notificationTemplate.title}" for ${user.role}: ${user.email}`
        );
      }
    }

    console.log(
      `\n🎉 Successfully created ${createdNotifications.length} notifications!`
    );

    // Create some role-specific notifications
    const adminUsers = users.filter((u) => u.role === "admin");
    const patientUsers = users.filter((u) => u.role === "patient");
    const pharmacyUsers = users.filter((u) => u.role === "pharmacy");

    console.log(`\n📊 User distribution:`);
    console.log(`  - Admins: ${adminUsers.length}`);
    console.log(`  - Patients: ${patientUsers.length}`);
    console.log(`  - Pharmacies: ${pharmacyUsers.length}`);

    // Create admin-specific notifications
    if (adminUsers.length > 0) {
      for (const admin of adminUsers) {
        const adminNotification = new AdvancedNotification({
          title: "Admin Dashboard Updates 👨‍💼",
          message:
            "New admin features available: user management, analytics dashboard, and system monitoring tools.",
          type: "system_alert",
          priority: "high",
          recipients: [
            {
              userId: admin._id,
              userRole: admin.role,
              deliveryStatus: "pending",
            },
          ],
          spatial: { enabled: false },
          targeting: { roles: ["admin"] },
          referenceData: { referenceType: "general" },
          createdBy: { userId: admin._id, userRole: "system", isSystem: true },
          status: "active",
        });

        await adminNotification.save();
        console.log(
          `✅ Created admin-specific notification for: ${admin.email}`
        );
      }
    }

    // Create patient-specific notifications
    if (patientUsers.length > 0) {
      const firstFewPatients = patientUsers.slice(0, 5); // Just first 5 to avoid spam
      for (const patient of firstFewPatients) {
        const patientNotification = new AdvancedNotification({
          title: "Health Tips & Prescription Updates 🏥",
          message:
            "Stay healthy! Remember to check your prescription status and book appointments when needed.",
          type: "appointment",
          priority: "medium",
          recipients: [
            {
              userId: patient._id,
              userRole: patient.role,
              deliveryStatus: "pending",
            },
          ],
          spatial: { enabled: false },
          targeting: { roles: ["patient"] },
          referenceData: { referenceType: "general" },
          createdBy: {
            userId: patient._id,
            userRole: "system",
            isSystem: true,
          },
          status: "active",
        });

        await patientNotification.save();
        console.log(
          `✅ Created patient-specific notification for: ${patient.email}`
        );
      }
    }

    // Create pharmacy-specific notifications
    if (pharmacyUsers.length > 0) {
      for (const pharmacy of pharmacyUsers) {
        const pharmacyNotification = new AdvancedNotification({
          title: "Pharmacy Portal Enhancement 💊",
          message:
            "New features: inventory management, prescription processing, and customer communication tools are now available.",
          type: "system_alert",
          priority: "high",
          recipients: [
            {
              userId: pharmacy._id,
              userRole: pharmacy.role,
              deliveryStatus: "pending",
            },
          ],
          spatial: { enabled: false },
          targeting: { roles: ["pharmacy"] },
          referenceData: { referenceType: "general" },
          createdBy: {
            userId: pharmacy._id,
            userRole: "system",
            isSystem: true,
          },
          status: "active",
        });

        await pharmacyNotification.save();
        console.log(
          `✅ Created pharmacy-specific notification for: ${pharmacy.email}`
        );
      }
    }

    // Final count
    const totalNotifications = await AdvancedNotification.countDocuments({});
    console.log(`\n📈 Total notifications in database: ${totalNotifications}`);

    return totalNotifications;
  } catch (error) {
    console.error("❌ Error creating notifications:", error);
    throw error;
  }
};

// Main function
const createNotifications = async () => {
  console.log("🚀 Starting notification creation script...\n");

  await connectDB();

  try {
    const total = await createSampleNotifications();
    console.log(
      `\n✅ Script completed successfully! Created notifications for all users.`
    );
    console.log(`📊 Total notifications created: ${total}`);
    console.log(
      `\n🔗 Now users should be able to see notifications in the frontend!`
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
