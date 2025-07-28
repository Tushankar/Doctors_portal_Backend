import dotenv from "dotenv";
import connectDB from "./config/db.js";
import Pharmacy from "./models/Pharmacy.js";
import { Prescription } from "./models/Prescription.js";
import { Order } from "./models/Order.js";

dotenv.config();

async function createTestOrder() {
  try {
    await connectDB();

    // Get a prescription and pharmacy
    const prescription = await Prescription.findOne({ status: "processed" });
    const pharmacy = await Pharmacy.findOne();

    if (!prescription || !pharmacy) {
      console.log("Missing data:", {
        prescription: !!prescription,
        pharmacy: !!pharmacy,
      });
      return;
    }

    console.log("Creating order with:");
    console.log("Prescription ID:", prescription._id);
    console.log("Pharmacy ID:", pharmacy._id);
    console.log("Patient ID:", prescription.patientId);

    // Create a test order
    const orderData = {
      orderNumber: `ORD${Date.now()}`,
      prescriptionId: prescription._id,
      patientId: prescription.patientId,
      pharmacyId: pharmacy._id,
      status: "placed",
      orderType: "delivery",
      totalAmount: 150.0,
      items: [
        {
          medicationName: "Test Medicine 1",
          dosage: "10mg",
          quantity: 30,
          unitPrice: 2.5,
          totalPrice: 75.0,
          instructions: "Take twice daily",
        },
        {
          medicationName: "Test Medicine 2",
          dosage: "5mg",
          quantity: 60,
          unitPrice: 1.25,
          totalPrice: 75.0,
          instructions: "Take once daily",
        },
      ],
      deliveryInfo: {
        address: {
          street: "123 Test Street",
          city: "Test City",
          state: "Test State",
          zipCode: "12345",
        },
        phoneNumber: "+1234567890",
        deliveryInstructions: "Leave at door",
        deliveryFee: 5.0,
      },
      paymentInfo: {
        method: "insurance",
        status: "pending",
        copayAmount: 20.0,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const order = await Order.create(orderData);
    console.log("Order created successfully:", order._id);

    // Update pharmacy status if needed
    if (!pharmacy.status || pharmacy.status === "pending") {
      await Pharmacy.findByIdAndUpdate(pharmacy._id, { status: "approved" });
      console.log("Updated pharmacy status to approved");
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    console.error("Stack:", error.stack);
    process.exit(1);
  }
}

createTestOrder();
