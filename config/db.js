import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    // Remove unintended unique index on licenseNumber for users collection
    try {
      await conn.connection.db.collection("users").dropIndex("licenseNumber_1");
      console.log("Dropped licenseNumber_1 index on users collection");
    } catch (err) {
      if (err.codeName === "IndexNotFound") {
        console.log("licenseNumber_1 index not found on users collection");
      } else {
        console.error("Error dropping licenseNumber_1 index:", err.message);
      }
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
