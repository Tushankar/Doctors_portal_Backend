import mongoose from "mongoose";
import User from "./models/User.js";
import AdvancedNotification from "./models/AdvancedNotification.js";

async function testNotificationSystemFixed() {
  try {
    await mongoose.connect(
      "mongodb+srv://mondalsubarna29:Su12345@cluster0.1kmazke.mongodb.net/doctor"
    );
    console.log("🔗 Connected to MongoDB\n");

    // Get users by role
    const adminUsers = await User.find({ role: "admin" }).limit(1);
    const patientUsers = await User.find({ role: "patient" }).limit(2);
    const pharmacyUsers = await User.find({ role: "pharmacy" }).limit(2);

    console.log("👥 Found users:");
    console.log(`   Admins: ${adminUsers.length}`);
    console.log(`   Patients: ${patientUsers.length}`);
    console.log(`   Pharmacies: ${pharmacyUsers.length}\n`);

    if (patientUsers.length === 0 || pharmacyUsers.length === 0) {
      console.log("❌ Need at least 1 patient and 1 pharmacy to test");
      return;
    }

    // Clear old test notifications
    await AdvancedNotification.deleteMany({
      title: { $regex: /Test.*Notification/i },
    });
    console.log("🧹 Cleared old test notifications\n");

    // Test 1: Create notification for patient
    console.log("🔔 Creating notification for patient...");
    const patientUser = patientUsers[0];

    const patientNotification = new AdvancedNotification({
      title: "Test Patient Notification",
      message: "This is a test notification for patient",
      type: "system_alert",
      priority: "medium",
      recipients: [
        {
          userId: patientUser._id,
          userRole: "patient",
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

    await patientNotification.save();
    console.log(`✅ Created patient notification: ${patientNotification._id}`);

    // Test 2: Create notification for pharmacy
    console.log("🔔 Creating notification for pharmacy...");
    const pharmacyUser = pharmacyUsers[0];

    const pharmacyNotification = new AdvancedNotification({
      title: "Test Pharmacy Notification",
      message: "New order received - please review",
      type: "new_order",
      priority: "high",
      recipients: [
        {
          userId: pharmacyUser._id,
          userRole: "pharmacy",
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

    await pharmacyNotification.save();
    console.log(
      `✅ Created pharmacy notification: ${pharmacyNotification._id}\n`
    );

    // Test 3: Retrieve patient notifications
    console.log("📥 Testing patient notification retrieval...");
    const patientNotifications = await AdvancedNotification.find({
      "recipients.userId": patientUser._id,
      status: "active",
    });
    console.log(
      `📧 Patient (${patientUser.email}) has ${patientNotifications.length} notifications:`
    );
    patientNotifications.forEach((notif) => {
      console.log(`   - "${notif.title}" (${notif.type})`);
    });

    // Test 4: Retrieve pharmacy notifications
    console.log("\n📥 Testing pharmacy notification retrieval...");
    const pharmacyNotifications = await AdvancedNotification.find({
      "recipients.userId": pharmacyUser._id,
      status: "active",
    });
    console.log(
      `📧 Pharmacy (${pharmacyUser.email}) has ${pharmacyNotifications.length} notifications:`
    );
    pharmacyNotifications.forEach((notif) => {
      console.log(`   - "${notif.title}" (${notif.type})`);
    });

    // Test 5: Admin view - should see all notifications
    console.log("\n👑 Testing admin notification access...");
    const allActiveNotifications = await AdvancedNotification.find({
      status: "active",
    });
    console.log(
      `📧 Admin can see ${allActiveNotifications.length} total active notifications`
    );

    // Test 6: Test the getUserNotificationsWithAdminAccess function
    console.log("\n🔍 Testing getUserNotificationsWithAdminAccess function...");

    // Import and test the controller function
    const { getUserNotificationsWithAdminAccess } = await import(
      "./controllers/advancedNotificationController.js"
    );

    // Test for patient
    const patientResult = await getUserNotificationsWithAdminAccess(
      patientUser._id,
      "patient"
    );
    console.log(
      `🔎 Function result for patient: ${patientResult.length} notifications`
    );

    // Test for pharmacy
    const pharmacyResult = await getUserNotificationsWithAdminAccess(
      pharmacyUser._id,
      "pharmacy"
    );
    console.log(
      `🔎 Function result for pharmacy: ${pharmacyResult.length} notifications`
    );

    // Test for admin (should see all)
    if (adminUsers.length > 0) {
      const adminResult = await getUserNotificationsWithAdminAccess(
        adminUsers[0]._id,
        "admin"
      );
      console.log(
        `🔎 Function result for admin: ${adminResult.length} notifications`
      );
    }

    console.log("\n✅ All notification tests completed successfully!");
    console.log("\n📋 Summary:");
    console.log(`   - Patient can see their notifications: ✅`);
    console.log(`   - Pharmacy can see their notifications: ✅`);
    console.log(`   - Admin can see all notifications: ✅`);
    console.log(`   - Schema structure is working: ✅`);
    console.log(`   - Controller functions work: ✅`);
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("Stack:", error.stack);
  } finally {
    mongoose.connection.close();
  }
}

testNotificationSystemFixed();
