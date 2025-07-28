import dotenv from "dotenv";
import connectDB from "./config/db.js";
import Pharmacy from "./models/Pharmacy.js";
import { Prescription } from "./models/Prescription.js";
import { Order } from "./models/Order.js";

dotenv.config();

async function createMultipleTestOrders() {
  try {
    await connectDB();

    // Get prescriptions and pharmacy
    const prescriptions = await Prescription.find({
      status: "processed",
    }).limit(3);
    const pharmacy = await Pharmacy.findOne();

    if (prescriptions.length === 0 || !pharmacy) {
      console.log("Missing data");
      return;
    }

    const orderStatuses = ["placed", "confirmed", "preparing"];
    const orderTypes = ["delivery", "pickup", "delivery"];

    for (let i = 0; i < Math.min(prescriptions.length, 3); i++) {
      const prescription = prescriptions[i];
      const status = orderStatuses[i];
      const orderType = orderTypes[i];

      const orderData = {
        orderNumber: `ORD${Date.now() + i}`,
        prescriptionId: prescription._id,
        patientId: prescription.patientId,
        pharmacyId: pharmacy._id,
        status: status,
        orderType: orderType,
        totalAmount: 125.0 + i * 25,
        items: [
          {
            medicationName: `Medication ${i + 1}A`,
            dosage: "10mg",
            quantity: 30,
            unitPrice: 2.0 + i,
            totalPrice: 60.0 + i * 15,
            notes: `Instructions for medication ${i + 1}A`,
          },
          {
            medicationName: `Medication ${i + 1}B`,
            dosage: "5mg",
            quantity: 60,
            unitPrice: 1.0 + i,
            totalPrice: 65.0 + i * 10,
            notes: `Instructions for medication ${i + 1}B`,
          },
        ],
        deliveryInfo:
          orderType === "delivery"
            ? {
                address: {
                  street: `${100 + i} Test Street`,
                  city: "Test City",
                  state: "Test State",
                  zipCode: `1234${i}`,
                },
                phoneNumber: `+123456789${i}`,
                deliveryInstructions: `Delivery instructions ${i + 1}`,
                deliveryFee: 5.0,
              }
            : undefined,
        pickupInfo:
          orderType === "pickup"
            ? {
                pickupInstructions: `Pickup instructions ${i + 1}`,
                estimatedPickupTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
              }
            : undefined,
        paymentInfo: {
          method: i === 0 ? "insurance" : i === 1 ? "card" : "cash",
          status: "pending",
          copayAmount: 15.0 + i * 5,
        },
      };

      const order = await Order.create(orderData);
      console.log(
        `Order ${i + 1} created: ${
          order._id
        } (Status: ${status}, Type: ${orderType})`
      );
    }

    console.log("All test orders created successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    console.error("Stack:", error.stack);
    process.exit(1);
  }
}

createMultipleTestOrders();
