import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Base User schema
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      match: [/.+@.+\..+/, "Please provide a valid email"],
    },
    password: { type: String, required: true, minlength: 6, select: false },
    role: {
      type: String,
      enum: ["patient", "pharmacy", "admin"],
      required: true,
    },
    isEmailVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  {
    discriminatorKey: "role",
    timestamps: true,
  }
);

// Hash password

userSchema.pre("save", async function (next) {
  try {
    console.log("[USER] Pre-save hook triggered for:", this.email || this._id);

    // If password is not modified, skip hashing
    if (!this.isModified("password")) {
      console.log("[USER] Password not modified, skipping hash.");
      return next();
    }

    // If password already hashed, skip hashing
    if (typeof this.password === "string" && this.password.startsWith("$2")) {
      console.log("[USER] Password already hashed, skipping re-hash.");
      return next();
    }

    // Generate salt and hash the password
    const salt = await bcrypt.genSalt(10);
    console.log("[USER] Salt generated");

    this.password = await bcrypt.hash(this.password, salt);
    console.log("[USER] Password hashed");

    next();
  } catch (err) {
    console.error("[USER] Error during pre-save password hashing:", err);
    next(err);
  }
});

userSchema.methods.comparePassword = async function (enteredPassword) {
  try {
    console.log(
      "[USER] Comparing passwords...",
      enteredPassword,
      this.password
    );
    const isMatch = await bcrypt.compare(enteredPassword, this.password);
    console.log(`[USER] Password match: ${isMatch}`);
    return isMatch;
  } catch (err) {
    console.error("[USER] Error comparing password:", err);
    throw err;
  }
};
// Base User model
const User = mongoose.model("User", userSchema);

// Minimal pharmacy discriminator
User.discriminator("pharmacy", new mongoose.Schema({}));

export default User;
