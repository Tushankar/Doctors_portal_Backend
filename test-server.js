import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import AdvancedNotification from "./models/AdvancedNotification.js";
import { User } from "./models/User.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect("mongodb://localhost:27017/doctor_portal");
    console.log("✅ MongoDB connected");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    process.exit(1);
  }
};

// Simple notification endpoints for testing
app.get("/api/test/notifications", async (req, res) => {
  try {
    const notifications = await AdvancedNotification.find({})
      .populate("recipients.userId", "name email role")
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({
      success: true,
      count: notifications.length,
      data: notifications,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching notifications",
      error: error.message,
    });
  }
});

app.post("/api/test/notifications", async (req, res) => {
  try {
    const { title, message, userRole = "patient" } = req.body;

    // Get a user to send notification to
    const user = await User.findOne({ role: userRole });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: `No ${userRole} user found`,
      });
    }

    const notification = new AdvancedNotification({
      title: title || "Test Notification",
      message: message || "This is a test notification",
      type: "system_alert",
      priority: "medium",
      recipients: [
        {
          userId: user._id,
          userRole: user.role,
          deliveryStatus: "pending",
        },
      ],
      spatial: { enabled: false },
      targeting: { roles: [user.role] },
      createdBy: {
        userId: user._id,
        userRole: "system",
        isSystem: true,
      },
      status: "active",
    });

    const saved = await notification.save();

    res.json({
      success: true,
      message: "Notification created successfully",
      data: saved,
    });
  } catch (error) {
    console.error("Error creating notification:", error);
    res.status(500).json({
      success: false,
      message: "Error creating notification",
      error: error.message,
    });
  }
});

// Get notifications for a specific user
app.get("/api/test/notifications/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const notifications = await AdvancedNotification.find({
      "recipients.userId": userId,
      status: "active",
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: notifications.length,
      data: notifications,
    });
  } catch (error) {
    console.error("Error fetching user notifications:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user notifications",
      error: error.message,
    });
  }
});

// Mark notification as read
app.put("/api/test/notifications/:id/read", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const notification = await AdvancedNotification.findById(id);
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    await notification.markAsRead(userId);

    res.json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({
      success: false,
      message: "Error marking notification as read",
      error: error.message,
    });
  }
});

// Health check
app.get("/api/test/health", (req, res) => {
  res.json({
    success: true,
    message: "Notification test server is running",
    timestamp: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 5001;

// Start server
const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`🚀 Notification test server running on port ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/api/test/health`);
    console.log(
      `🔗 Get notifications: http://localhost:${PORT}/api/test/notifications`
    );
    console.log(
      `🔗 Create notification: POST http://localhost:${PORT}/api/test/notifications`
    );
  });
};

startServer().catch((error) => {
  console.error("❌ Failed to start server:", error);
  process.exit(1);
});
