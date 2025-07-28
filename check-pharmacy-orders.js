import dotenv from "dotenv";
import connectDB from "./config/db.js";
import Pharmacy from "./models/Pharmacy.js";
import { Order } from "./models/Order.js";
import { Prescription } from "./models/Prescription.js";
import Patient from "./models/Patient.js";

dotenv.config();

async function checkPharmacyOrders() {
  try {
    await connectDB();

    // The logged in pharmacy user ID from the logs
    const loggedInPharmacyUserId = "6887389e8b076b4e0dad1e6b";

    // Find the pharmacy associated with this user
    const pharmacy = await Pharmacy.findOne({ userId: loggedInPharmacyUserId });

    if (!pharmacy) {
      console.log("No pharmacy found for user:", loggedInPharmacyUserId);
      return;
    }

    console.log("Logged in pharmacy:");
    console.log("- Pharmacy ID:", pharmacy._id);
    console.log("- Pharmacy Name:", pharmacy.pharmacyName);
    console.log("- User ID:", pharmacy.userId);
    console.log("- Status:", pharmacy.approvalStatus);

    // Find orders for this pharmacy
    const orders = await Order.find({ pharmacyId: pharmacy._id })
      .populate(
        "prescriptionId",
        "description ocrData createdAt uploadedAt validationResults"
      )
      .populate("patientId", "firstName lastName email phone")
      .sort({ createdAt: -1 });

    console.log(`\nFound ${orders.length} orders for this pharmacy:`);

    orders.forEach((order, index) => {
      console.log(`\nOrder ${index + 1}:`);
      console.log("- Order ID:", order._id);
      console.log("- Order Number:", order.orderNumber);
      console.log("- Status:", order.status);
      console.log(
        "- Patient:",
        order.patientId?.firstName,
        order.patientId?.lastName
      );
      console.log("- Prescription ID:", order.prescriptionId?._id);
      console.log("- Has OCR Data:", !!order.prescriptionId?.ocrData);
      if (order.prescriptionId?.ocrData?.medications) {
        console.log(
          "- Medications found:",
          order.prescriptionId.ocrData.medications.length
        );
      }
    });

    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

checkPharmacyOrders();
