import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Test MongoDB connection
const testConnection = async () => {
  try {
    console.log("🔄 Attempting to connect to MongoDB...");
    console.log(
      `🔗 Connection URI: ${process.env.MONGO_URI ? "Found" : "Not found"}`
    );

    // Try to connect
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Successfully connected to MongoDB");

    // List all collections
    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();
    console.log(`📊 Found ${collections.length} collections:`);
    collections.forEach((col) => console.log(`  - ${col.name}`));

    // Check if we have users
    const usersCount = await mongoose.connection.db
      .collection("users")
      .countDocuments();
    console.log(`👥 Total users: ${usersCount}`);

    // Check if we have notifications
    const notificationsCount = await mongoose.connection.db
      .collection("advancednotifications")
      .countDocuments();
    console.log(`🔔 Total advanced notifications: ${notificationsCount}`);

    // Check if we have regular notifications
    const regularNotificationsCount = await mongoose.connection.db
      .collection("notifications")
      .countDocuments();
    console.log(`📢 Total regular notifications: ${regularNotificationsCount}`);

    // Sample some users
    if (usersCount > 0) {
      const sampleUsers = await mongoose.connection.db
        .collection("users")
        .find({})
        .limit(3)
        .toArray();
      console.log("\n👤 Sample users:");
      sampleUsers.forEach((user) => {
        console.log(
          `  - ${user.name || user.email} (${user.role}) - ID: ${user._id}`
        );
      });
    }

    // Sample some notifications if any
    if (notificationsCount > 0) {
      const sampleNotifications = await mongoose.connection.db
        .collection("advancednotifications")
        .find({})
        .limit(3)
        .toArray();
      console.log("\n🔔 Sample advanced notifications:");
      sampleNotifications.forEach((notification) => {
        console.log(
          `  - ${notification.title} [${notification.type}] - Recipients: ${
            notification.recipients?.length || 0
          }`
        );
      });
    }

    if (regularNotificationsCount > 0) {
      const sampleRegularNotifications = await mongoose.connection.db
        .collection("notifications")
        .find({})
        .limit(3)
        .toArray();
      console.log("\n📢 Sample regular notifications:");
      sampleRegularNotifications.forEach((notification) => {
        console.log(
          `  - ${notification.message} - User: ${notification.userId}`
        );
      });
    }
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);

    // Check if MongoDB is running
    if (error.message.includes("ECONNREFUSED")) {
      console.log(
        "💡 Suggestion: Make sure MongoDB is running on localhost:27017"
      );
      console.log("   - Start MongoDB service");
      console.log("   - Or check if connection string is correct");
    }
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
    process.exit(0);
  }
};

console.log("🔍 Database Diagnostic Script Starting...\n");
testConnection();
