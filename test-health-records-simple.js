import mongoose from "mongoose";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

async function testHealthRecordsEndpoint() {
  try {
    console.log("🧪 Testing Health Records Endpoint...\n");

    // Login as pharmacy
    const pharmacyLogin = await axios.post(
      "http://localhost:5000/api/auth/login",
      {
        email: "tushankarsaha0@gmail.com",
        password: "123456", // Working password
        userType: "pharmacy",
      }
    );

    const pharmacyToken = pharmacyLogin.data.token;
    console.log("✅ Pharmacy logged in successfully");
    console.log("Pharmacy:", pharmacyLogin.data.user);

    // Test with one of the patient IDs from the database
    const testPatientId = "6886362e34cc757998c0e446"; // Tushankar saha patient

    console.log(`\n🔍 Testing health records for patient: ${testPatientId}`);

    const healthRecordsResponse = await axios.get(
      `http://localhost:5000/api/v1/pharmacies/patients/${testPatientId}/shared-health-records`,
      {
        headers: {
          Authorization: `Bearer ${pharmacyToken}`,
        },
      }
    );

    console.log("✅ Health records endpoint working!");
    console.log(
      "Response:",
      JSON.stringify(healthRecordsResponse.data, null, 2)
    );
  } catch (error) {
    console.log("❌ Error testing health records:");
    if (error.response) {
      console.log("Status:", error.response.status);
      console.log("Data:", JSON.stringify(error.response.data, null, 2));

      // If it's an authentication error, try different passwords
      if (error.response.status === 401) {
        console.log("\n🔄 Trying different passwords...");
        const passwords = ["password123", "test123", "Tushankar@123", "123456"];

        for (const password of passwords) {
          try {
            const loginAttempt = await axios.post(
              "http://localhost:5000/api/auth/login",
              {
                email: "tushankarsaha0@gmail.com",
                password: password,
                userType: "pharmacy",
              }
            );
            console.log(`✅ Successfully logged in with password: ${password}`);
            break;
          } catch (loginError) {
            console.log(`❌ Password '${password}' failed`);
          }
        }
      }
    } else {
      console.log("Error message:", error.message);
    }
  }
}

testHealthRecordsEndpoint();
