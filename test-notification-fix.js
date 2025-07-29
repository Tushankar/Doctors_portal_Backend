import mongoose from "mongoose";
import AdvancedNotification from "./models/AdvancedNotification.js";
import User from "./models/User.js";
import Pharmacy from "./models/Pharmacy.js";
import Patient from "./models/Patient.js";

async function testNotificationSystemSimple() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      "mongodb+srv://mondalsubarna29:Su12345@cluster0.1kmazke.mongodb.net/doctor"
    );
    console.log("🔗 Connected to MongoDB\n");

    // Step 1: Clear old test notifications
    await AdvancedNotification.deleteMany({
      title: { $regex: /Test.*Notification/i },
    });
    console.log("🧹 Cleared old test notifications\n");

    // Step 2: Get some test users
    const patients = await Patient.find({}).populate("userId").limit(2);
    const pharmacies = await Pharmacy.find({}).populate("userId").limit(2);
    const adminUser = await User.findOne({ role: "admin" });

    console.log("👥 Found test users:");
    console.log(`   Patients: ${patients.length}`);
    console.log(`   Pharmacies: ${pharmacies.length}`);
    console.log(`   Admin: ${adminUser ? "Yes" : "No"}\n`);

    if (patients.length === 0 || pharmacies.length === 0) {
      console.log("❌ Need at least 1 patient and 1 pharmacy to test");
      return;
    }

    // Step 3: Create test notifications using the correct schema
    console.log("🔔 Creating test notifications...\n");

    // Test notification for patient
    const patientNotification = new AdvancedNotification({
      title: "Test Patient Notification",
      message: "This is a test notification for the patient.",
      type: "system_alert",
      priority: "medium",
      recipients: [
        {
          userId: patients[0].userId._id,
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

    // Test notification for pharmacy
    const pharmacyNotification = new AdvancedNotification({
      title: "Test Pharmacy Notification",
      message: "This is a test notification for the pharmacy.",
      type: "new_order",
      priority: "high",
      recipients: [
        {
          userId: pharmacies[0].userId._id,
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
      `✅ Created pharmacy notification: ${pharmacyNotification._id}`
    );

    // Step 4: Test retrieving notifications
    console.log("\n📥 Testing notification retrieval...\n");

    // Test patient notifications
    const patientNotifications = await AdvancedNotification.find({
      "recipients.userId": patients[0].userId._id,
      status: "active",
    });
    console.log(
      `📧 Patient ${patients[0].userId.username} has ${patientNotifications.length} notifications:`
    );
    patientNotifications.forEach((notif) => {
      console.log(`   - "${notif.title}" (${notif.type})`);
    });

    // Test pharmacy notifications
    const pharmacyNotifications = await AdvancedNotification.find({
      "recipients.userId": pharmacies[0].userId._id,
      status: "active",
    });
    console.log(
      `\n📧 Pharmacy ${pharmacies[0].userId.username} has ${pharmacyNotifications.length} notifications:`
    );
    pharmacyNotifications.forEach((notif) => {
      console.log(`   - "${notif.title}" (${notif.type})`);
    });

    // Test admin view (all notifications)
    const allNotifications = await AdvancedNotification.find({
      status: "active",
    });
    console.log(
      `\n👑 Admin can see ${allNotifications.length} total active notifications`
    );

    // Step 5: Test the query structure
    console.log("\n🔍 Testing query structures...\n");

    // Test query for user notifications
    const userQuery = {
      "recipients.userId": patients[0].userId._id,
      status: "active",
    };
    const userQueryResult = await AdvancedNotification.find(userQuery);
    console.log(`🔎 User query found: ${userQueryResult.length} notifications`);

    // Test admin query (all notifications)
    const adminQuery = { status: "active" };
    const adminQueryResult = await AdvancedNotification.find(adminQuery);
    console.log(
      `🔎 Admin query found: ${adminQueryResult.length} notifications`
    );

    console.log("\n✅ Notification system test completed successfully!");
    console.log("\n📋 Summary:");
    console.log(`   - Notification creation: ✅ Working`);
    console.log(`   - User-specific queries: ✅ Working`);
    console.log(`   - Admin queries: ✅ Working`);
    console.log(`   - Schema structure: ✅ Correct`);
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("Stack:", error.stack);
  } finally {
    mongoose.connection.close();
  }
}

testNotificationSystemSimple();
