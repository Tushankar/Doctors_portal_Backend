// Quick test to check if the server can start without errors
import AdvancedNotification from "./models/AdvancedNotification.js";
import Pharmacy from "./models/Pharmacy.js";
import Patient from "./models/Patient.js";
import { Order } from "./models/Order.js";
import { Prescription } from "./models/Prescription.js";

console.log("✅ Testing imports for advanced notification controller...");

console.log("✅ AdvancedNotification model:", typeof AdvancedNotification);
console.log("✅ Pharmacy model:", typeof Pharmacy);
console.log("✅ Patient model:", typeof Patient);
console.log("✅ Order model:", typeof Order);
console.log("✅ Prescription model:", typeof Prescription);

console.log("\n🎉 All imports successful! Server should start without errors.");
console.log("🚀 Ready to start the main server with: node server.js");

process.exit(0);
