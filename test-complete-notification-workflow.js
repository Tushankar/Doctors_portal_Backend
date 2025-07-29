import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import { advancedNotificationController } from "./controllers/advancedNotificationController.js";
import { prescriptionController } from "./controllers/prescriptionController.js";
import { orderController } from "./controllers/orderController.js";
import Pharmacy from "./models/Pharmacy.js";
import Patient from "./models/Patient.js";
import User from "./models/User.js";
import { Prescription } from "./models/Prescription.js";
import { Order } from "./models/Order.js";
import { AdvancedNotification } from "./models/AdvancedNotification.js";

async function testCompleteNotificationWorkflow() {
  try {
    await connectDB();
    console.log("🚀 Testing Complete Notification Workflow...\n");

    // Step 1: Get test pharmacy and patient
    const pharmacy = await Pharmacy.findOne().populate("userId");
    const patient = await Patient.findOne().populate("userId");

    if (!pharmacy || !patient) {
      console.error(
        "❌ Need at least one pharmacy and one patient in database"
      );
      return;
    }

    console.log(`📋 Test Setup:`);
    console.log(
      `   Pharmacy: ${pharmacy.pharmacyName} (User: ${pharmacy.userId.username})`
    );
    console.log(`   Patient: ${patient.userId.username}\n`);

    // Step 2: Create a test order (Patient orders from Pharmacy)
    console.log("🛒 Step 1: Patient creates order...");
    const orderData = {
      patientId: patient._id,
      pharmacyId: pharmacy._id,
      items: [
        {
          name: "Test Medicine",
          dosage: "500mg",
          quantity: 30,
          price: 25.99,
        },
      ],
      deliveryAddress: {
        street: "123 Test St",
        city: "Test City",
        state: "TS",
        zipCode: "12345",
      },
      totalAmount: 25.99,
    };

    const orderResult = await orderController.createOrder(orderData);
    if (orderResult.success) {
      console.log(`✅ Order created: ${orderResult.data._id}`);

      // Check if pharmacy received notification
      const pharmacyNotifications =
        await advancedNotificationController.getUserNotifications(
          pharmacy.userId._id.toString()
        );
      console.log(
        `📧 Pharmacy notifications: ${pharmacyNotifications.data.length} total`
      );

      const orderNotification = pharmacyNotifications.data.find(
        (n) => n.relatedData.orderId === orderResult.data._id.toString()
      );
      if (orderNotification) {
        console.log(
          `✅ Pharmacy received order notification: "${orderNotification.title}"`
        );
      } else {
        console.log(`❌ Pharmacy did not receive order notification`);
      }
    } else {
      console.log(`❌ Order creation failed: ${orderResult.message}`);
      return;
    }

    // Step 3: Create a prescription for approval workflow
    console.log("\n💊 Step 2: Creating prescription for approval workflow...");

    // Create a test prescription
    const prescriptionData = {
      patientId: patient._id,
      fileName: "test-prescription.jpg",
      uploadedBy: patient.userId._id,
      ocrData: {
        medications: [
          {
            name: "Test Prescription Medicine",
            dosage: "250mg",
            frequency: "twice daily",
            instructions: "Take with food",
          },
        ],
        processingStatus: "completed",
      },
      status: "pending_approval",
      approvalRequests: [
        {
          pharmacyId: pharmacy._id,
          requestedAt: new Date(),
          status: "pending",
        },
      ],
    };

    const prescription = new Prescription(prescriptionData);
    await prescription.save();
    console.log(`✅ Prescription created: ${prescription._id}`);

    // Step 4: Pharmacy approves prescription
    console.log("\n✅ Step 3: Pharmacy approves prescription...");
    const approvalResult = await prescriptionController.respondApproval(
      prescription._id.toString(),
      pharmacy.userId._id.toString(),
      "approved"
    );

    if (approvalResult.success) {
      console.log(`✅ Prescription approved successfully`);

      // Check if patient received approval notification
      const patientNotifications =
        await advancedNotificationController.getUserNotifications(
          patient.userId._id.toString()
        );
      console.log(
        `📧 Patient notifications: ${patientNotifications.data.length} total`
      );

      const approvalNotification = patientNotifications.data.find(
        (n) => n.relatedData.prescriptionId === prescription._id.toString()
      );
      if (approvalNotification) {
        console.log(
          `✅ Patient received approval notification: "${approvalNotification.title}"`
        );
      } else {
        console.log(`❌ Patient did not receive approval notification`);
      }
    } else {
      console.log(`❌ Prescription approval failed: ${approvalResult.message}`);
    }

    // Step 5: Test admin can see all notifications
    console.log("\n👑 Step 4: Testing admin visibility...");
    const adminUser = await User.findOne({ role: "admin" });
    if (adminUser) {
      const adminNotifications =
        await advancedNotificationController.getUserNotificationsWithAdminAccess(
          adminUser._id.toString()
        );
      console.log(
        `📧 Admin can see ${adminNotifications.data.length} total notifications`
      );
      console.log(
        `   Types: ${[
          ...new Set(adminNotifications.data.map((n) => n.type)),
        ].join(", ")}`
      );
    } else {
      console.log(`⚠️ No admin user found for testing admin visibility`);
    }

    // Step 6: Summary of all notifications in database
    console.log("\n📊 Step 5: Notification Summary...");
    const allNotifications = await AdvancedNotification.find()
      .populate("recipientId", "username role")
      .sort({ createdAt: -1 })
      .limit(10);

    console.log(`📧 Recent Notifications (${allNotifications.length}/total):`);
    allNotifications.forEach((notif, index) => {
      console.log(
        `   ${index + 1}. ${notif.type} → ${
          notif.recipientId?.username || "Unknown"
        } (${notif.recipientId?.role || "unknown"})`
      );
      console.log(
        `      "${notif.title}" - ${notif.isRead ? "Read" : "Unread"}`
      );
    });

    console.log("\n🎉 Complete Notification Workflow Test Completed!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error(error.stack);
  } finally {
    mongoose.connection.close();
  }
}

// Run the test
testCompleteNotificationWorkflow();
