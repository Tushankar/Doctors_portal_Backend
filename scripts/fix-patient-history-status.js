// MongoDB script to fix Patient prescriptionHistory status
// Run this in MongoDB Compass or MongoDB shell

// Connect to your database: Use the MONGODB_URI from your .env file

// Find patients with old "pending" status in prescriptionHistory
db.patients.find({ "prescriptionHistory.status": "pending" });

// Update all patients with "pending" status to "pending_approval" in prescriptionHistory
db.patients.updateMany(
  { "prescriptionHistory.status": "pending" },
  { $set: { "prescriptionHistory.$.status": "pending_approval" } }
);

// Since the above only updates the first matching element, we need to update all elements
// Let's find and update each patient individually
db.patients
  .find({ "prescriptionHistory.status": "pending" })
  .forEach(function (patient) {
    patient.prescriptionHistory.forEach(function (history, index) {
      if (history.status === "pending") {
        db.patients.updateOne(
          { _id: patient._id },
          {
            $set: {
              [`prescriptionHistory.${index}.status`]: "pending_approval",
            },
          }
        );
      }
    });
  });

// Verify the update
db.patients.find({ "prescriptionHistory.status": "pending_approval" });
