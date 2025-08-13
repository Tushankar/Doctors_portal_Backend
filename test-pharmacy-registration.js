import dotenv from "dotenv";
import fetch from "node-fetch";
import FormData from "form-data";
import fs from "fs";
import path from "path";

// Load environment variables
dotenv.config();

const SERVER_URL = "http://localhost:1111";

// Test pharmacy registration
async function testPharmacyRegistration() {
  try {
    console.log("Testing pharmacy registration...");

    const form = new FormData();

    // Basic registration data
    form.append("email", "testpharmacy@example.com");
    form.append("password", "TestPassword123!");
    form.append("role", "pharmacy");

    // Pharmacy profile data
    form.append("profileData[pharmacyName]", "Test Pharmacy");
    form.append("profileData[typeOfPharmacy]", "retail");
    form.append("profileData[licenseNumber]", "LIC123456789");
    form.append("profileData[pharmacistName]", "Dr. Test Pharmacist");
    form.append("profileData[phone]", "+1234567890");
    form.append(
      "profileData[address]",
      "123 Test Street, Test City, Test State, 12345"
    );
    form.append("profileData[location][type]", "Point");
    form.append(
      "profileData[location][coordinates]",
      JSON.stringify([-74.006, 40.7128])
    ); // NYC coordinates
    form.append("profileData[deliveryAvailable]", "true");
    form.append("profileData[deliveryRadius]", "10");
    form.append(
      "profileData[services]",
      JSON.stringify(["prescription_filling", "consultation"])
    );
    form.append(
      "profileData[operatingHours]",
      JSON.stringify({
        monday: { open: "09:00", close: "18:00" },
        tuesday: { open: "09:00", close: "18:00" },
        wednesday: { open: "09:00", close: "18:00" },
        thursday: { open: "09:00", close: "18:00" },
        friday: { open: "09:00", close: "18:00" },
        saturday: { open: "09:00", close: "16:00" },
        sunday: { open: "10:00", close: "14:00" },
      })
    );

    // Create a dummy PDF file for verification documents
    const dummyPdfContent =
      "%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n174\n%%EOF";
    const tempPdfPath = path.join(process.cwd(), "temp_license.pdf");
    fs.writeFileSync(tempPdfPath, dummyPdfContent);

    form.append("verificationDocuments", fs.createReadStream(tempPdfPath), {
      filename: "pharmacy_license.pdf",
      contentType: "application/pdf",
    });

    const response = await fetch(`${SERVER_URL}/api/v1/auth/register`, {
      method: "POST",
      body: form,
      headers: form.getHeaders(),
    });

    const result = await response.json();

    console.log("Registration Response Status:", response.status);
    console.log("Registration Response:", JSON.stringify(result, null, 2));

    // Clean up temp file
    if (fs.existsSync(tempPdfPath)) {
      fs.unlinkSync(tempPdfPath);
    }

    if (response.ok) {
      console.log("✅ Pharmacy registration successful!");
      console.log("✅ Admin should receive notification email");
    } else {
      console.log("❌ Pharmacy registration failed");
    }
  } catch (error) {
    console.error("Test error:", error);
  }
}

// Run the test
testPharmacyRegistration();
