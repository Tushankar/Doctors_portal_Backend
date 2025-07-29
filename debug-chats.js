import mongoose from "mongoose";
import ChatThread from "./models/ChatThread.js";
import dotenv from "dotenv";

dotenv.config();

async function debugChats() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const orderId = "6887b3d4f5c8cfccd28514fa";
    console.log(`\n=== DEBUGGING CHATS FOR ORDER ID: ${orderId} ===`);

    // Find all chat threads for this order
    const threads = await ChatThread.find({ orderId: orderId });
    console.log(`\nFound ${threads.length} chat threads for this order:`);

    threads.forEach((thread, index) => {
      console.log(`\n--- Thread ${index + 1} ---`);
      console.log(`Thread ID: ${thread._id}`);
      console.log(`Order ID: ${thread.orderId}`);
      console.log(`Participants: ${thread.participants}`);
      console.log(`Message count: ${thread.messages.length}`);

      if (thread.messages.length > 0) {
        console.log(`Messages:`);
        thread.messages.forEach((msg, msgIndex) => {
          console.log(
            `  ${msgIndex + 1}. ${msg.sender}: ${msg.content} (${
              msg.createdAt
            })`
          );
        });
      } else {
        console.log(`No messages in this thread`);
      }
    });

    // Also find threads with this orderId as a string (in case of data type mismatch)
    console.log(`\n=== CHECKING FOR STRING MATCHES ===`);
    const stringThreads = await ChatThread.find({
      orderId: orderId.toString(),
    });
    console.log(`Found ${stringThreads.length} threads with string orderId`);

    // Check all threads to see if any mention this order
    console.log(`\n=== CHECKING ALL THREADS ===`);
    const allThreads = await ChatThread.find({});
    console.log(`Total threads in database: ${allThreads.length}`);

    const relatedThreads = allThreads.filter(
      (thread) =>
        thread.orderId &&
        (thread.orderId.toString() === orderId || thread.orderId === orderId)
    );

    console.log(
      `Threads related to order ${orderId}: ${relatedThreads.length}`
    );
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

debugChats();
