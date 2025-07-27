import ChatThread from "../models/ChatThread.js";
import ApiError from "../utils/ApiError.js";

// Initialize or fetch thread for patient-pharmacy pair
export const initChat = async (patientId, pharmacyId) => {
  let thread = await ChatThread.findOne({
    participants: { $all: [patientId, pharmacyId] },
  });
  if (!thread) {
    thread = new ChatThread({
      participants: [patientId, pharmacyId],
      messages: [],
    });
    await thread.save();
  }
  return { success: true, data: { threadId: thread._id } };
};

// Get chat history
export const getChatHistory = async (threadId) => {
  const thread = await ChatThread.findById(threadId).lean();
  if (!thread) throw new ApiError("Chat thread not found", 404);
  return { success: true, data: { messages: thread.messages } };
};

// Send a message
export const sendMessage = async (threadId, sender, content) => {
  const thread = await ChatThread.findById(threadId);
  if (!thread) throw new ApiError("Chat thread not found", 404);
  thread.messages.push({ sender, content });
  await thread.save();
  return { success: true, data: { message: thread.messages.at(-1) } };
};

// Fetch all chat threads for a user
export const getChatThreads = async (userId) => {
  // find threads involving the user
  const threads = await ChatThread.find({ participants: userId })
    .populate("participants", "profile.name role")
    .lean();
  return { success: true, data: threads };
};
