import mongoose from "mongoose";
import User from "./models/User.js";
import Patient from "./models/Patient.js";
import Pharmacy from "./models/Pharmacy.js";

async function checkUsers() {
  try {
    await mongoose.connect(
      "mongodb+srv://mondalsubarna29:Su12345@cluster0.1kmazke.mongodb.net/doctor"
    );
    console.log("🔗 Connected to MongoDB\n");

    // Check users by role
    const allUsers = await User.find({}).select("username email role");
    console.log("👥 All Users:");
    allUsers.forEach((user) => {
      console.log(`   ${user.username} (${user.email}) - ${user.role}`);
    });
    console.log(`   Total: ${allUsers.length} users\n`);

    // Check patients
    const patients = await Patient.find({}).populate(
      "userId",
      "username email role"
    );
    console.log("🏥 Patients:");
    patients.forEach((patient) => {
      console.log(
        `   ${patient.name} - User: ${
          patient.userId ? patient.userId.username : "No user linked"
        }`
      );
    });
    console.log(`   Total: ${patients.length} patients\n`);

    // Check pharmacies
    const pharmacies = await Pharmacy.find({}).populate(
      "userId",
      "username email role"
    );
    console.log("💊 Pharmacies:");
    pharmacies.forEach((pharmacy) => {
      console.log(
        `   ${pharmacy.name} - User: ${
          pharmacy.userId ? pharmacy.userId.username : "No user linked"
        }`
      );
    });
    console.log(`   Total: ${pharmacies.length} pharmacies\n`);

    // Let's create a simple test if we have users
    if (allUsers.length > 0) {
      const AdvancedNotification = (
        await import("./models/AdvancedNotification.js")
      ).default;

      // Create a test notification for the first user
      const testUser = allUsers[0];
      console.log(
        `🔔 Creating test notification for ${testUser.username}...\n`
      );

      const testNotification = new AdvancedNotification({
        title: "Simple Test Notification",
        message: "Testing if notifications work",
        type: "system_alert",
        priority: "medium",
        recipients: [
          {
            userId: testUser._id,
            userRole: testUser.role,
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
      console.log(`✅ Created notification: ${testNotification._id}`);

      // Now try to retrieve it
      const retrievedNotifications = await AdvancedNotification.find({
        "recipients.userId": testUser._id,
        status: "active",
      });

      console.log(
        `📥 Found ${retrievedNotifications.length} notifications for ${testUser.username}`
      );
      retrievedNotifications.forEach((notif) => {
        console.log(`   - "${notif.title}" (${notif.type})`);
      });

      // Test admin view
      const allNotifications = await AdvancedNotification.find({
        status: "active",
      });
      console.log(
        `\n👑 Total active notifications in system: ${allNotifications.length}`
      );

      console.log("\n✅ Basic notification test completed!");
    } else {
      console.log("❌ No users found to test with");
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    mongoose.connection.close();
  }
}

checkUsers();
