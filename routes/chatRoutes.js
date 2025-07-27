import { Router } from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  initChat,
  getChatHistory,
  sendMessage,
  getChatThreads,
} from "../controllers/chatController.js";

const router = Router();

// All chat routes require authentication
router.use(protect);

// Initialize or fetch chat thread for patient-pharmacy
router.post("/init", async (req, res, next) => {
  try {
    const { pharmacyId } = req.body;
    const patientId = req.user.id;
    const result = await initChat(patientId, pharmacyId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Get chat history for a thread
router.get("/:threadId", async (req, res, next) => {
  try {
    const result = await getChatHistory(req.params.threadId);
    res.json(result);
  } catch (err) {
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

export default router;
