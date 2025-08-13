// Test script to check admin authentication and API responses
// This should be run in the browser console while logged in as admin

const testAdminAPI = async () => {
  try {
    console.log("🔍 Testing Admin API endpoints...\n");

    // Test authentication check
    console.log("1. Testing authentication...");
    const authResponse = await fetch("/api/v1/auth/me", {
      credentials: "include",
    });
    const authData = await authResponse.json();
    console.log("Auth status:", authResponse.status);
    console.log("Auth data:", authData);

    if (!authData.success) {
      console.error("❌ Not authenticated or not admin");
      return;
    }

    // Test pharmacy approvals endpoint
    console.log("\n2. Testing pharmacy approvals endpoint...");
    const approvalsResponse = await fetch("/api/v1/admin/pharmacy-approvals", {
      credentials: "include",
    });
    const approvalsData = await approvalsResponse.json();
    console.log("Approvals status:", approvalsResponse.status);
    console.log("Approvals data:", approvalsData);

    // Test dashboard stats
    console.log("\n3. Testing dashboard stats...");
    const statsResponse = await fetch("/api/v1/admin/dashboard/stats", {
      credentials: "include",
    });
    const statsData = await statsResponse.json();
    console.log("Stats status:", statsResponse.status);
    console.log("Stats data:", statsData);

    // Test pharmacies endpoint
    console.log("\n4. Testing pharmacies endpoint...");
    const pharmaciesResponse = await fetch("/api/v1/admin/pharmacies", {
      credentials: "include",
    });
    const pharmaciesData = await pharmaciesResponse.json();
    console.log("Pharmacies status:", pharmaciesResponse.status);
    console.log("Pharmacies data:", pharmaciesData);

    // Test patients endpoint
    console.log("\n5. Testing patients endpoint...");
    const patientsResponse = await fetch("/api/v1/admin/patients", {
      credentials: "include",
    });
    const patientsData = await patientsResponse.json();
    console.log("Patients status:", patientsResponse.status);
    console.log("Patients data:", patientsData);
  } catch (error) {
    console.error("❌ Test error:", error);
  }
};

// Instructions for the user
console.log(`
🔧 ADMIN API TEST SCRIPT
=======================

To test the admin API endpoints:

1. Open your browser developer tools (F12)
2. Go to the Console tab
3. Make sure you're logged in as admin
4. Copy and paste this function, then run: testAdminAPI()

This will help us debug what's happening with the API calls.
`);

// Auto-run if we're in a browser environment
if (typeof window !== "undefined") {
  testAdminAPI();
}
