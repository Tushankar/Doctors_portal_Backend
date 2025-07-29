import mongoose from "mongoose";
const { Schema } = mongoose;

const MessageSchema = new Schema({
  sender: { type: String, enum: ["patient", "pharmacy"], required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  readBy: [
    {
      userType: { type: String, enum: ["patient", "pharmacy"], required: true },
      userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
      readAt: { type: Date, default: Date.now },
    },
  ],
});

const ChatThreadSchema = new Schema(
  {
    participants: [
      { type: Schema.Types.ObjectId, ref: "User", required: true },
    ],
    messages: [MessageSchema],
    prescriptionId: {
      type: Schema.Types.ObjectId,
      ref: "Prescription",
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      index: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const ChatThread = mongoose.model("ChatThread", ChatThreadSchema);
export default ChatThread;
