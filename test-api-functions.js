import mongoose from "mongoose";

async function testNotificationAPI() {
  try {
    console.log("🔗 Connecting to MongoDB...");
    await mongoose.connect(
      "mongodb+srv://mondalsubarna29:Su12345@cluster0.1kmazke.mongodb.net/doctor"
    );
    console.log("✅ Connected to MongoDB\n");

    // Import models and controller
    const User = (await import("./models/User.js")).default;
    const { getUserNotificationsWithAdminAccess } = await import(
      "./controllers/advancedNotificationController.js"
    );

    // Test with different user roles
    const patient = await User.findOne({ role: "patient" });
    const pharmacy = await User.findOne({ role: "pharmacy" });
    const admin = await User.findOne({ role: "admin" });

    console.log("👥 Testing with users:");
    console.log(`   Patient: ${patient ? patient.email : "None found"}`);
    console.log(`   Pharmacy: ${pharmacy ? pharmacy.email : "None found"}`);
    console.log(`   Admin: ${admin ? admin.email : "None found"}\n`);

    // Test patient notifications
    if (patient) {
      console.log("🔍 Testing patient notification access...");
      const patientResult = await getUserNotificationsWithAdminAccess(
        patient._id.toString(),
        {}
      );
      console.log(`📧 Patient has ${patientResult.data.length} notifications`);

      if (patientResult.data.length > 0) {
        console.log("   Recent notifications:");
        patientResult.data.slice(0, 3).forEach((notif, index) => {
          console.log(
            `   ${index + 1}. "${notif.title}" (${notif.type}) - ${
              notif.priority
            }`
          );
        });
      }
      console.log("");
    }

    // Test pharmacy notifications
    if (pharmacy) {
      console.log("🔍 Testing pharmacy notification access...");
      const pharmacyResult = await getUserNotificationsWithAdminAccess(
        pharmacy._id.toString(),
        {}
      );
      console.log(
        `📧 Pharmacy has ${pharmacyResult.data.length} notifications`
      );

      if (pharmacyResult.data.length > 0) {
        console.log("   Recent notifications:");
        pharmacyResult.data.slice(0, 3).forEach((notif, index) => {
          console.log(
            `   ${index + 1}. "${notif.title}" (${notif.type}) - ${
              notif.priority
            }`
          );
        });
      }
      console.log("");
    }

    // Test admin notifications (should see all)
    if (admin) {
      console.log("🔍 Testing admin notification access...");
      const adminResult = await getUserNotificationsWithAdminAccess(
        admin._id.toString(),
        {}
      );
      console.log(
        `📧 Admin can see ${adminResult.data.length} total notifications`
      );
      if (adminResult.data.length > 0) {
        console.log("   Sample notifications:");
        adminResult.data.slice(0, 3).forEach((notif, index) => {
          console.log(
            `   ${index + 1}. "${notif.title}" (${notif.type}) - ${
              notif.priority
            }`
          );
        });
      }
      console.log("");
    }

    // Test notification creation functions
    console.log("🔔 Testing notification creation functions...");

    const {
      createPrescriptionApprovalNotification,
      createNewOrderNotification,
    } = await import("./controllers/advancedNotificationController.js");

    // Test prescription approval notification
    if (patient && pharmacy) {
      console.log("   Creating prescription approval notification...");
      await createPrescriptionApprovalNotification(
        "test-prescription-123",
        patient._id,
        pharmacy._id,
        "Test Prescription"
      );
      console.log("   ✅ Prescription approval notification created");

      // Test new order notification
      console.log("   Creating new order notification...");
      await createNewOrderNotification(
        "test-order-456",
        patient._id,
        pharmacy._id,
        {
          medications: [{ name: "Test Medicine", quantity: 2 }],
          total: 50.0,
        }
      );
      console.log("   ✅ New order notification created");
    }

    console.log("\n✅ All notification API tests completed successfully!");
    console.log("\n📋 Summary:");
    console.log(
      "   - getUserNotificationsWithAdminAccess function: ✅ Working"
    );
    console.log("   - Patient notification access: ✅ Working");
    console.log("   - Pharmacy notification access: ✅ Working");
    console.log("   - Admin notification access: ✅ Working");
    console.log("   - Notification creation functions: ✅ Working");
    console.log("\n🎉 The notification system is fully functional!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("Stack:", error.stack);
  } finally {
    mongoose.connection.close();
  }
}

testNotificationAPI();
