import ChatThread from "../models/ChatThread.js";
import ApiError from "../utils/ApiError.js";

// Initialize or fetch thread for patient-pharmacy pair (with optional prescription or order)
export const initChat = async (
  patientId,
  pharmacyId,
  prescriptionId = null,
  orderId = null
) => {
  let query = {
    participants: { $all: [patientId, pharmacyId] },
  };

  if (orderId) {
    query.orderId = orderId;
  } else if (prescriptionId) {
    query.prescriptionId = prescriptionId;
  } else {
    query.prescriptionId = { $exists: false };
    query.orderId = { $exists: false };
  }

  let thread = await ChatThread.findOne(query);

  if (!thread) {
    thread = new ChatThread({
      participants: [patientId, pharmacyId],
      messages: [],
      prescriptionId: prescriptionId || undefined,
      orderId: orderId || undefined,
    });
    await thread.save();
  }
  return { success: true, data: { threadId: thread._id } };
};

// Initialize chat specifically for an order
export const initOrderChat = async (orderId, patientId, pharmacyId) => {
  console.log("=== INIT ORDER CHAT CONTROLLER ===");
  console.log("Parameters received:", { orderId, patientId, pharmacyId });

  // IMPORTANT: Find ANY existing thread for this order, regardless of participants
  // This ensures everyone joins the same conversation for the same order
  let thread = await ChatThread.findOne({
    orderId: orderId,
  });

  console.log("Existing thread found (any participants):", !!thread);
  if (thread) {
    console.log("Existing thread details:", {
      threadId: thread._id,
      orderId: thread.orderId,
      participants: thread.participants,
      messageCount: thread.messages.length,
    });

    // Add missing participants if they're not already in the thread
    const participantsSet = new Set(
      thread.participants.map((p) => p.toString())
    );
    let participantsUpdated = false;

    if (!participantsSet.has(patientId.toString())) {
      thread.participants.push(patientId);
      participantsUpdated = true;
      console.log("Added patient to existing thread:", patientId);
    }

    if (!participantsSet.has(pharmacyId.toString())) {
      thread.participants.push(pharmacyId);
      participantsUpdated = true;
      console.log("Added pharmacy to existing thread:", pharmacyId);
    }

    if (participantsUpdated) {
      await thread.save();
      console.log("Updated thread participants:", thread.participants);
    }
  }

  if (!thread) {
    console.log("Creating new chat thread...");
    thread = new ChatThread({
      participants: [patientId, pharmacyId],
      messages: [],
      orderId: orderId,
    });
    await thread.save();
    console.log("New thread created:", {
      threadId: thread._id,
      orderId: thread.orderId,
      participants: thread.participants,
    });
  }

  const result = { success: true, data: { threadId: thread._id } };
  console.log("Returning result:", result);
  return result;
};

// Get chat history
export const getChatHistory = async (threadId) => {
  console.log("=== GET CHAT HISTORY CONTROLLER ===");
  console.log("Thread ID:", threadId);

  const thread = await ChatThread.findById(threadId).lean();
  if (!thread) {
    console.error("Chat thread not found for ID:", threadId);
    throw new ApiError("Chat thread not found", 404);
  }

  console.log("Thread found:", {
    threadId: thread._id,
    orderId: thread.orderId,
    participants: thread.participants,
    messageCount: thread.messages.length,
  });

  console.log("Messages in thread:", thread.messages);

  return { success: true, data: { messages: thread.messages } };
};

// Send a message
export const sendMessage = async (threadId, sender, content) => {
  console.log("=== SEND MESSAGE CONTROLLER ===");
  console.log("Parameters:", { threadId, sender, content });

  const thread = await ChatThread.findById(threadId);
  if (!thread) {
    console.error("Chat thread not found for ID:", threadId);
    throw new ApiError("Chat thread not found", 404);
  }

  console.log("Thread found:", {
    threadId: thread._id,
    orderId: thread.orderId,
    participants: thread.participants,
    messageCount: thread.messages.length,
    messagesPreview: thread.messages.slice(-2), // Show last 2 messages
  });

  const newMessage = { sender, content, createdAt: new Date() };
  console.log("Adding new message:", newMessage);

  thread.messages.push(newMessage);
  const savedThread = await thread.save();

  console.log("Thread saved successfully:", {
    messageCount: savedThread.messages.length,
    lastMessage: savedThread.messages.at(-1),
  });

  return { success: true, data: { message: savedThread.messages.at(-1) } };
};

// Fetch all chat threads for a user
export const getChatThreads = async (userId) => {
  console.log("=== GET CHAT THREADS ===");
  console.log("User ID:", userId);

  // Find threads involving the user and populate participant details
  const threads = await ChatThread.find({ participants: userId })
    .populate({
      path: "participants",
      select: "role email firstName lastName", // For Patient model
    })
    .populate("prescriptionId", "status description createdAt")
    .populate("orderId", "orderNumber status totalAmount createdAt")
    .lean();

  console.log("Found threads:", threads.length);

  // Enhance threads with participant information from Pharmacy model if needed
  const enhancedThreads = await Promise.all(
    threads.map(async (thread) => {
      const enhancedParticipants = await Promise.all(
        thread.participants.map(async (participant) => {
          let participantInfo = { ...participant };

          if (participant.role === "pharmacy") {
            // Fetch pharmacy details separately
            const Pharmacy = (await import("../models/Pharmacy.js")).default;
            const pharmacyDetails = await Pharmacy.findOne({
              userId: participant._id,
            })
              .select("pharmacyName")
              .lean();

            if (pharmacyDetails) {
              participantInfo.pharmacyName = pharmacyDetails.pharmacyName;
              participantInfo.name = pharmacyDetails.pharmacyName;
            }
          } else if (participant.role === "patient") {
            // For patients, combine firstName and lastName
            if (participant.firstName && participant.lastName) {
              participantInfo.name = `${participant.firstName} ${participant.lastName}`;
            }
          }

          return participantInfo;
        })
      );

      return {
        ...thread,
        participants: enhancedParticipants,
      };
    })
  );

  console.log(
    "Enhanced threads with participant names:",
    enhancedThreads.map((t) => ({
      id: t._id,
      participants: t.participants.map((p) => ({
        role: p.role,
        name: p.name,
        firstName: p.firstName,
        lastName: p.lastName,
        pharmacyName: p.pharmacyName,
      })),
    }))
  );

  return { success: true, data: enhancedThreads };
};

// DEBUG: Fetch all chat threads for a specific order ID
export const getAllChatsByOrderId = async (orderId) => {
  console.log("=== GET ALL CHATS BY ORDER ID ===");
  console.log("Order ID:", orderId);

  const threads = await ChatThread.find({ orderId: orderId }).lean();

  console.log("Found threads for order:", {
    orderIdSearched: orderId,
    threadCount: threads.length,
    threads: threads.map((t) => ({
      threadId: t._id,
      participants: t.participants,
      messageCount: t.messages.length,
      messages: t.messages,
    })),
  });

  return { success: true, data: threads };
};

// Get unread message counts for orders for the current user
export const getUnreadMessageCounts = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log("=== GET UNREAD MESSAGE COUNTS ===");
    console.log("User ID:", userId, "Role:", userRole);

    // Find all chat threads where the user is a participant
    const threads = await ChatThread.find({
      participants: userId,
      isActive: true,
    }).lean();

    console.log("Found threads for user:", threads.length);

    const unreadCounts = {};

    for (const thread of threads) {
      if (!thread.orderId) continue; // Skip if no order ID

      const orderId = thread.orderId.toString();

      // Count unread messages (messages not read by this user)
      const unreadMessages = thread.messages.filter((message) => {
        // Skip messages sent by the current user
        if (message.sender === userRole) return false;

        // Check if this user has read the message
        const hasRead =
          message.readBy &&
          message.readBy.some(
            (reader) =>
              reader.userId.toString() === userId &&
              reader.userType === userRole
          );

        return !hasRead;
      });

      if (unreadMessages.length > 0) {
        unreadCounts[orderId] = {
          count: unreadMessages.length,
          threadId: thread._id.toString(),
          lastMessage: unreadMessages[unreadMessages.length - 1],
        };
      }
    }

    console.log("Unread counts:", unreadCounts);

    res.json({
      success: true,
      data: unreadCounts,
    });
  } catch (error) {
    console.error("Error getting unread message counts:", error);
    next(new ApiError(500, "Failed to get unread message counts"));
  }
};

// Mark messages as read for a specific thread
export const markMessagesAsRead = async (req, res, next) => {
  try {
    const { threadId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log("=== MARK MESSAGES AS READ ===");
    console.log("Thread ID:", threadId, "User ID:", userId, "Role:", userRole);

    const thread = await ChatThread.findById(threadId);
    if (!thread) {
      return next(new ApiError(404, "Chat thread not found"));
    }

    // Mark all unread messages as read by this user
    let updatedCount = 0;
    for (const message of thread.messages) {
      // Skip messages sent by the current user
      if (message.sender === userRole) continue;

      // Check if this user has already read the message
      const hasRead =
        message.readBy &&
        message.readBy.some(
          (reader) =>
            reader.userId.toString() === userId && reader.userType === userRole
        );

      if (!hasRead) {
        if (!message.readBy) {
          message.readBy = [];
        }
        message.readBy.push({
          userType: userRole,
          userId: userId,
          readAt: new Date(),
        });
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      await thread.save();
      console.log(`Marked ${updatedCount} messages as read`);
    }

    res.json({
      success: true,
      data: {
        threadId,
        markedAsRead: updatedCount,
      },
    });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    next(new ApiError(500, "Failed to mark messages as read"));
  }
};
