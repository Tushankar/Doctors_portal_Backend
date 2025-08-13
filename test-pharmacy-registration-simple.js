// Simple test for pharmacy registration admin notification
import fetch from "node-fetch";
import FormData from "form-data";
import fs from "fs";

const SERVER_URL = "http://localhost:1111";

async function testPharmacyRegistration() {
  try {
    console.log("🧪 Testing pharmacy registration with admin notification...");

    // Create a simple PDF content
    const pdfContent = Buffer.from(
      "%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\nxref\n0 1\ntrailer\n<<\n/Root 1 0 R\n>>\n%%EOF"
    );

    const form = new FormData();

    // Add basic registration fields
    form.append("email", `testpharmacy${Date.now()}@example.com`);
    form.append("password", "SecurePassword123!");
    form.append("role", "pharmacy");

    // Add pharmacy data
    form.append("profileData[pharmacyName]", "Test Pharmacy Store");
    form.append("profileData[typeOfPharmacy]", "retail");
    form.append("profileData[licenseNumber]", `LIC${Date.now()}`);
    form.append("profileData[pharmacistName]", "Dr. Test Pharmacist");
    form.append("profileData[phone]", "+1234567890");
    form.append("profileData[address]", "123 Main St, Test City, TS 12345");
    form.append("profileData[location][coordinates]", "[-74.006, 40.7128]");

    // Add a dummy PDF document
    form.append("verificationDocuments", pdfContent, {
      filename: "license.pdf",
      contentType: "application/pdf",
    });

    console.log("📤 Sending registration request...");

    const response = await fetch(`${SERVER_URL}/api/v1/auth/register`, {
      method: "POST",
      body: form,
    });

    const result = await response.json();

    console.log("📨 Response Status:", response.status);
    console.log("📋 Response Body:", JSON.stringify(result, null, 2));

    if (response.ok) {
      console.log("✅ Pharmacy registration successful!");
      console.log("✅ Check server logs for admin notification details");
    } else {
      console.log("❌ Registration failed:", result.message);
    }
  } catch (error) {
    console.error("❌ Test error:", error.message);
  }
}

// Run the test
testPharmacyRegistration();
