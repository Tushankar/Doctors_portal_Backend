// Test script to check order data structure with OCR details
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Order } from "./models/Order.js";

// Load environment variables
dotenv.config();

async function testOrderData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Get all orders with populated prescription data
    const orders = await Order.find({})
      .populate("patientId", "firstName lastName email phone address")
      .populate(
        "prescriptionId",
        "description ocrData createdAt uploadedAt validationResults"
      )
      .limit(3);

    console.log(`Found ${orders.length} orders`);

    orders.forEach((order, index) => {
      console.log(`\n--- Order ${index + 1} ---`);
      console.log(`Order Number: ${order.orderNumber}`);
      console.log(`Status: ${order.status}`);
      console.log(
        `Patient: ${order.patientId?.firstName} ${order.patientId?.lastName}`
      );
      console.log(`Total Amount: ${order.totalAmount}`);

      if (order.prescriptionId) {
        console.log(`Prescription ID: ${order.prescriptionId._id}`);
        console.log(
          `Prescription Description: ${
            order.prescriptionId.description || "None"
          }`
        );

        if (order.prescriptionId.ocrData) {
          console.log(
            `OCR Status: ${order.prescriptionId.ocrData.processingStatus}`
          );
          console.log(
            `OCR Confidence: ${order.prescriptionId.ocrData.confidence}`
          );

          if (order.prescriptionId.ocrData.medications?.length > 0) {
            console.log(
              `Medications (${order.prescriptionId.ocrData.medications.length}):`
            );
            order.prescriptionId.ocrData.medications.forEach(
              (med, medIndex) => {
                console.log(
                  `  ${medIndex + 1}. ${med.name} - ${med.dosage} (${
                    med.frequency
                  })`
                );
              }
            );
          } else {
            console.log(`No medications extracted from OCR`);
          }
        } else {
          console.log(`No OCR data available`);
        }

        if (order.prescriptionId.validationResults) {
          console.log(
            `Prescription Valid: ${order.prescriptionId.validationResults.isValid}`
          );
          if (order.prescriptionId.validationResults.flags?.length > 0) {
            console.log(
              `Validation Flags: ${order.prescriptionId.validationResults.flags.length}`
            );
          }
        }
      } else {
        console.log(`No prescription data`);
      }

      console.log(`Order Items: ${order.items?.length || 0}`);
    });

    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

testOrderData();
