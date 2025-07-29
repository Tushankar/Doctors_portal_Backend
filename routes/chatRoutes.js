import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  initChat,
  initOrderChat,
  getChatHistory,
  sendMessage,
  getChatThreads,
  getAllChatsByOrderId,
  getUnreadMessageCounts,
  markMessagesAsRead,
} from "../controllers/chatController.js";

const router = Router();

// All chat routes require authentication
router.use(protect);

// Initialize or fetch chat thread for patient-pharmacy
router.post("/init", async (req, res, next) => {
  try {
    const { pharmacyId, prescriptionId, orderId } = req.body;
    const patientId = req.user.id;
    const result = await initChat(
      patientId,
      pharmacyId,
      prescriptionId,
      orderId
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Initialize chat thread specifically for an order
router.post("/init-order", async (req, res, next) => {
  try {
    console.log("=== CHAT INIT-ORDER ROUTE ===");
    console.log("Request body:", req.body);
    console.log("User info:", { id: req.user.id, role: req.user.role });

    const { orderId, pharmacyId } = req.body;
    const userId = req.user.id;

    console.log("Extracted values:", { orderId, pharmacyId, userId });

    // Determine if user is patient or pharmacy and set the other participant
    let patientId, actualPharmacyId;
    if (req.user.role === "patient") {
      patientId = userId;
      actualPharmacyId = pharmacyId;
      console.log("Patient initiating chat:", { patientId, actualPharmacyId });
    } else {
      // If pharmacy is initiating, we need to get patient from order
      actualPharmacyId = userId;
      // We'll need to fetch the order to get patientId - for now assume it's passed
      patientId = req.body.patientId;
      console.log("Pharmacy initiating chat:", { actualPharmacyId, patientId });
    }

    console.log("Final parameters for initOrderChat:", {
      orderId,
      patientId,
      actualPharmacyId,
    });
    const result = await initOrderChat(orderId, patientId, actualPharmacyId);
    console.log("initOrderChat result:", result);

    res.json(result);
  } catch (err) {
    console.error("Error in init-order route:", err);
    next(err);
  }
});

// Get all chat threads for user
router.get("/threads", async (req, res, next) => {
  try {
    const result = await getChatThreads(req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Get unread message counts for all orders (MUST be before /:threadId route)
router.get("/unread-counts", getUnreadMessageCounts);

// DEBUG: Get all chats for a specific order ID (MUST be before /:threadId route)
router.get("/debug/order/:orderId", async (req, res, next) => {
  try {
    console.log("=== DEBUG ROUTE: GET CHATS BY ORDER ID ===");
    console.log("Order ID from params:", req.params.orderId);
    console.log("User requesting:", { id: req.user.id, role: req.user.role });

    const result = await getAllChatsByOrderId(req.params.orderId);
    res.json(result);
  } catch (err) {
    console.error("Error in debug route:", err);
    next(err);
  }
});

// Get chat history for a thread (MUST be after specific routes)
router.get("/:threadId", async (req, res, next) => {
  try {
    const result = await getChatHistory(req.params.threadId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Send a message in a thread
router.post("/send", async (req, res, next) => {
  try {
    const { threadId, content } = req.body;
    const sender = req.user.role === "pharmacy" ? "pharmacy" : "patient";
    const result = await sendMessage(threadId, sender, content);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Mark messages as read for a specific thread
router.put("/thread/:threadId/mark-read", markMessagesAsRead);

export default router;
