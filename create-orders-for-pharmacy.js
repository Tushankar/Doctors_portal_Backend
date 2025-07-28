import dotenv from "dotenv";
import connectDB from "./config/db.js";
import Pharmacy from "./models/Pharmacy.js";
import { Prescription } from "./models/Prescription.js";
import { Order } from "./models/Order.js";

dotenv.config();

async function createOrdersForLoggedInPharmacy() {
  try {
    await connectDB();

    // The logged in pharmacy user ID
    const loggedInPharmacyUserId = "6887389e8b076b4e0dad1e6b";

    // Find the pharmacy for this user
    const pharmacy = await Pharmacy.findOne({ userId: loggedInPharmacyUserId });
    if (!pharmacy) {
      console.log("No pharmacy found for user");
      return;
    }

    console.log("Creating orders for pharmacy:", pharmacy.pharmacyName);
    console.log("Pharmacy ID:", pharmacy._id);

    // Get prescriptions with OCR data
    const prescriptions = await Prescription.find({
      status: "processed",
      "ocrData.processingStatus": "completed",
    }).limit(3);

    if (prescriptions.length === 0) {
      console.log("No processed prescriptions found");
      return;
    }

    const orderStatuses = ["placed", "confirmed", "preparing"];
    const orderTypes = ["delivery", "pickup", "delivery"];

    for (let i = 0; i < Math.min(prescriptions.length, 3); i++) {
      const prescription = prescriptions[i];
      const status = orderStatuses[i];
      const orderType = orderTypes[i];

      // Create order based on OCR extracted medications
      const ocrMedications = prescription.ocrData?.medications || [];
      const items = [];

      // If we have OCR medications, use them; otherwise create generic items
      if (ocrMedications.length > 0) {
        ocrMedications.forEach((med, medIndex) => {
          items.push({
            medicationName: med.name || `Medication ${medIndex + 1}`,
            dosage: med.dosage || "10mg",
            quantity: med.frequency === "twice daily" ? 60 : 30,
            unitPrice: 2.0 + medIndex,
            totalPrice:
              (2.0 + medIndex) * (med.frequency === "twice daily" ? 60 : 30),
            notes: med.instructions || `Instructions for ${med.name}`,
          });
        });
      } else {
        // Fallback items
        items.push({
          medicationName: `Medicine A (Order ${i + 1})`,
          dosage: "10mg",
          quantity: 30,
          unitPrice: 3.0,
          totalPrice: 90.0,
          notes: "Take as prescribed",
        });
      }

      const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);

      const orderData = {
        orderNumber: `ORD${Date.now() + i}${Math.floor(Math.random() * 100)}`,
        prescriptionId: prescription._id,
        patientId: prescription.patientId,
        pharmacyId: pharmacy._id, // Use the correct pharmacy ID
        status: status,
        orderType: orderType,
        totalAmount: totalAmount,
        items: items,
        deliveryInfo:
          orderType === "delivery"
            ? {
                address: {
                  street: `${200 + i} Pharmacy Test Street`,
                  city: "Kolkata",
                  state: "West Bengal",
                  zipCode: `70010${i}`,
                },
                phoneNumber: `+91936253226${i}`,
                deliveryInstructions: `Delivery for order ${i + 1}`,
                deliveryFee: 10.0,
              }
            : undefined,
        pickupInfo:
          orderType === "pickup"
            ? {
                pickupInstructions: `Pickup for order ${i + 1}`,
                estimatedPickupTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
              }
            : undefined,
        paymentInfo: {
          method: i === 0 ? "insurance" : i === 1 ? "card" : "cash",
          status: "pending",
          copayAmount: 20.0 + i * 10,
        },
      };

      const order = await Order.create(orderData);
      console.log(`✅ Order ${i + 1} created: ${order._id}`);
      console.log(`   Status: ${status}, Type: ${orderType}`);
      console.log(`   Patient: ${prescription.patientId}`);
      console.log(`   Prescription: ${prescription._id}`);
      console.log(`   Items: ${items.length} medications`);
      console.log("");
    }

    console.log("All orders created successfully for the logged-in pharmacy!");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    console.error("Stack:", error.stack);
    process.exit(1);
  }
}

createOrdersForLoggedInPharmacy();
