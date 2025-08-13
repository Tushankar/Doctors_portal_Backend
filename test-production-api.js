import fetch from "node-fetch";

const testProductionAPI = async () => {
  try {
    console.log("Testing production API endpoints...\n");

    // Test 1: Basic API health
    const healthResponse = await fetch(
      "https://doctors-portal-backend-2.onrender.com/"
    );
    const healthText = await healthResponse.text();
    console.log("✅ API Health Check:", healthText.trim());

    // Test 2: Check pending approvals (would need admin auth, but let's see the response)
    try {
      const approvalsResponse = await fetch(
        "https://doctors-portal-backend-2.onrender.com/api/v1/admin/pharmacy-approvals",
        {
          credentials: "include",
        }
      );
      const approvalsData = await approvalsResponse.json();
      console.log(
        "📋 Pharmacy Approvals Endpoint Status:",
        approvalsResponse.status
      );
      console.log("📋 Response:", approvalsData);
    } catch (err) {
      console.log("📋 Pharmacy Approvals - Expected auth error:", err.message);
    }
  } catch (error) {
    console.error("❌ Production API Test Error:", error.message);
  }
};

testProductionAPI();
