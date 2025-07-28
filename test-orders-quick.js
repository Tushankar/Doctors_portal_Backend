import dotenv from "dotenv";
import connectDB from "./config/db.js";
import { Order } from "./models/Order.js";
import { Prescription } from "./models/Prescription.js";
import Pharmacy from "./models/Pharmacy.js";
import Patient from "./models/Patient.js";

dotenv.config();

async function testOrders() {
  try {
    await connectDB();

    const orders = await Order.find()
      .limit(5)
      .populate("prescriptionId")
      .populate("pharmacyId")
      .populate("patientId");

    console.log("Found", orders.length, "orders");
    if (orders.length > 0) {
      console.log("Sample order:", JSON.stringify(orders[0], null, 2));
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

testOrders();
