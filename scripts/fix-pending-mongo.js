// Direct MongoDB script to update pending status to pending_approval
// Run this in MongoDB Compass or MongoDB shell

// Connect to your database: mongodb+srv://mondalsubarna29:Su12345@cluster0.1kmazke.mongodb.net/doctor

// Find all prescriptions with "pending" status
db.prescriptions.find({ status: "pending" });

// Update all prescriptions with "pending" status to "pending_approval"
db.prescriptions.updateMany(
  { status: "pending" },
  { $set: { status: "pending_approval" } }
);

// Verify the update
db.prescriptions.find({ status: "pending_approval" });
