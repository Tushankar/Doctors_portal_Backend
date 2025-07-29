import { Router } from "express";
import { protect, authorize } from "../middleware/authMiddleware.js";
import {
  createNotification,
  getUserNotifications,
  getUserNotificationsWithAdminAccess,
  markNotificationAsRead,
  trackNotificationAction,
  getNotificationsByLocation,
  getNotificationAnalytics,
} from "../controllers/advancedNotificationController.js";

const router = Router();

// All notification routes require authentication
router.use(protect);

// Get user's notifications with advanced filtering
router.get("/", getUserNotifications);

// Get notifications with admin access (admin can see all)
router.get("/admin", getUserNotificationsWithAdminAccess);

// Get approval notifications (for compatibility)
router.get("/approvals", (req, res) => {
  req.query.type = "approval";
  return getUserNotifications(req, res);
});

// Get order status notifications (for compatibility)
router.get("/order-status", (req, res) => {
  req.query.type = "order_status";
  return getUserNotifications(req, res);
});

// Get notifications by location (spatial feature)
router.get("/location", getNotificationsByLocation);

// Create new notification (admin and pharmacy only)
router.post("/", authorize("admin", "pharmacy"), createNotification);

// Mark notification as read
router.post("/:notificationId/read", markNotificationAsRead);

// Track notification action (click, dismiss, etc.)
router.post("/:notificationId/action", trackNotificationAction);

// Get notification analytics (admin only)
router.get("/analytics", authorize("admin"), getNotificationAnalytics);

export default router;
