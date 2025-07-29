import mongoose from "mongoose";
import ChatThread from "./models/ChatThread.js";
import dotenv from "dotenv";

dotenv.config();

async function mergeChatThreads() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const orderId = "6887b3d4f5c8cfccd28514fa";
    console.log(`\n=== MERGING CHAT THREADS FOR ORDER ID: ${orderId} ===`);

    // Find all chat threads for this order
    const threads = await ChatThread.find({ orderId: orderId });
    console.log(`Found ${threads.length} chat threads for this order`);

    if (threads.length <= 1) {
      console.log("No merging needed - only one or no threads found");
      return;
    }

    // Collect all messages and participants
    let allMessages = [];
    let allParticipants = new Set();

    threads.forEach((thread, index) => {
      console.log(`\n--- Processing Thread ${index + 1} ---`);
      console.log(`Thread ID: ${thread._id}`);
      console.log(`Participants: ${thread.participants}`);
      console.log(`Message count: ${thread.messages.length}`);

      // Add participants
      thread.participants.forEach((p) => allParticipants.add(p.toString()));

      // Add messages
      thread.messages.forEach((msg) => {
        allMessages.push({
          sender: msg.sender,
          content: msg.content,
          createdAt: msg.createdAt,
        });
      });
    });

    // Sort messages by creation time
    allMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    console.log(`\n=== MERGE SUMMARY ===`);
    console.log(`Total unique participants: ${allParticipants.size}`);
    console.log(`Total messages: ${allMessages.length}`);
    console.log(`Participants: ${Array.from(allParticipants)}`);

    // Keep the first thread and update it with all data
    const primaryThread = threads[0];
    primaryThread.participants = Array.from(allParticipants);
    primaryThread.messages = allMessages;

    await primaryThread.save();
    console.log(`\nUpdated primary thread ${primaryThread._id} with all data`);

    // Delete the other threads
    const threadsToDelete = threads.slice(1);
    for (const thread of threadsToDelete) {
      await ChatThread.findByIdAndDelete(thread._id);
      console.log(`Deleted duplicate thread ${thread._id}`);
    }

    console.log(`\n=== MERGE COMPLETE ===`);
    console.log(`Kept thread: ${primaryThread._id}`);
    console.log(`Deleted ${threadsToDelete.length} duplicate threads`);
    console.log(`Final message count: ${allMessages.length}`);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

mergeChatThreads();
