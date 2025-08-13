import mongoose from "mongoose";
import RefillRequest from "./controllers/refillController.js";
import dotenv from "dotenv";

dotenv.config();

const cleanupDuplicateRefillRequests = async () => {
  try {
    console.log("🧹 Cleaning up duplicate refill requests...");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Find all pending refill requests
    const pendingRequests = await RefillRequest.find({
      status: "pending",
    }).sort({ createdAt: 1 }); // Oldest first

    console.log(`Found ${pendingRequests.length} pending refill requests`);

    // Group by originalOrderId
    const groupedByOrder = pendingRequests.reduce((acc, req) => {
      const orderId = req.originalOrderId.toString();
      if (!acc[orderId]) {
        acc[orderId] = [];
      }
      acc[orderId].push(req);
      return acc;
    }, {});

    let duplicatesRemoved = 0;

    // For each order, keep only the oldest request and remove duplicates
    for (const [orderId, requests] of Object.entries(groupedByOrder)) {
      if (requests.length > 1) {
        console.log(
          `\n📦 Order ${orderId} has ${requests.length} pending refill requests`
        );

        // Keep the first (oldest) request, remove the rest
        const toKeep = requests[0];
        const toRemove = requests.slice(1);

        console.log(
          `  ✅ Keeping: ${toKeep._id} (created: ${toKeep.createdAt})`
        );

        for (const req of toRemove) {
          console.log(`  ❌ Removing: ${req._id} (created: ${req.createdAt})`);
          await RefillRequest.findByIdAndDelete(req._id);
          duplicatesRemoved++;
        }
      }
    }

    console.log(
      `\n✅ Cleanup complete! Removed ${duplicatesRemoved} duplicate refill requests`
    );

    // Show final summary
    const finalCount = await RefillRequest.countDocuments({
      status: "pending",
    });
    console.log(`📊 Remaining pending refill requests: ${finalCount}`);
  } catch (error) {
    console.error("❌ Error cleaning up refill requests:", error);
  } finally {
    await mongoose.connection.close();
    console.log("\n🔌 Database connection closed");
  }
};

cleanupDuplicateRefillRequests();
