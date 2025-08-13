import dotenv from "dotenv";
dotenv.config();

// Test the admin query that should get notified
import("./config/db.js")
  .then((connectDB) => {
    connectDB.default();
    import("./models/Admin.js").then((AdminModule) => {
      const Admin = AdminModule.default;
      return Admin.find({
        $or: [{ permissions: "manage_pharmacies" }, { isSuperAdmin: true }],
      }).then((admins) => {
        console.log("Found admins that should be notified:", admins.length);
        admins.forEach((admin) => {
          console.log("Admin:", {
            email: admin.email,
            permissions: admin.permissions,
            isSuperAdmin: admin.isSuperAdmin,
          });
        });

        // Test email function
        import("./utils/sendEmail.js")
          .then((emailModule) => {
            const { sendApprovalNotificationToAdmin } = emailModule;
            console.log("Testing email notification to first admin...");

            if (admins.length > 0) {
              return sendApprovalNotificationToAdmin(admins[0].email, {
                pharmacyName: "Test Pharmacy",
                email: "test@example.com",
                requestId: "66bb1234567890abcdef1234",
              });
            }
          })
          .then(() => {
            console.log("✅ Email test completed successfully");
            process.exit(0);
          })
          .catch((emailError) => {
            console.error("❌ Email test failed:", emailError);
            process.exit(1);
          });
      });
    });
  })
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
