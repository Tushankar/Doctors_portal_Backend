import dotenv from "dotenv";
dotenv.config();

// Connect to database and check current state
import("./config/db.js")
  .then((connectDB) => {
    connectDB.default();

    Promise.all([
      import("./models/PharmacyApproval.js"),
      import("./models/Admin.js"),
      import("./models/Pharmacy.js"),
    ])
      .then(([PharmacyApprovalModule, AdminModule, PharmacyModule]) => {
        const PharmacyApproval = PharmacyApprovalModule.default;
        const Admin = AdminModule.default;
        const Pharmacy = PharmacyModule.default;

        return Promise.all([
          PharmacyApproval.find({}).sort("-createdAt"),
          Admin.find({}),
          Pharmacy.find({}).sort("-createdAt"),
        ]);
      })
      .then(([approvals, admins, pharmacies]) => {
        console.log("\n=== DATABASE STATE ===");
        console.log(`\n📋 Pharmacy Approval Requests: ${approvals.length}`);
        approvals.forEach((approval, index) => {
          console.log(
            `  ${index + 1}. ${approval.pharmacyData.pharmacyName} (${
              approval.pharmacyData.email
            })`
          );
          console.log(`     Status: ${approval.status}`);
          console.log(`     Created: ${approval.createdAt}`);
          console.log(`     Request ID: ${approval._id}`);
        });

        console.log(`\n👨‍💼 Admins: ${admins.length}`);
        admins.forEach((admin, index) => {
          console.log(`  ${index + 1}. ${admin.email}`);
          console.log(`     Permissions: ${admin.permissions.join(", ")}`);
          console.log(`     Super Admin: ${admin.isSuperAdmin}`);
        });

        console.log(`\n🏥 Approved Pharmacies: ${pharmacies.length}`);
        pharmacies.forEach((pharmacy, index) => {
          console.log(`  ${index + 1}. ${pharmacy.pharmacyName}`);
          console.log(`     Status: ${pharmacy.approvalStatus}`);
          console.log(`     Created: ${pharmacy.createdAt}`);
        });

        process.exit(0);
      })
      .catch((err) => {
        console.error("Error:", err);
        process.exit(1);
      });
  })
  .catch((err) => {
    console.error("Database connection error:", err);
    process.exit(1);
  });
