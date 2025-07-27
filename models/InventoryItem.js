import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema({
  pharmacyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Pharmacy",
    required: true,
  },
  medicineName: {
    type: String,
    required: true,
    trim: true,
  },
  brandName: {
    type: String,
    trim: true,
    required: false,
  },
  batchNumber: {
    type: String,
    required: true,
  },
  dosageForm: {
    type: String, // Tablet, Syrup, Injection
    required: true,
  },
  strength: {
    type: String, // e.g., 500mg, 5ml
    required: false,
  },
  unitWeightOrVolume: {
    type: Number, // in mg or ml
    required: false,
  },
  unitMeasurement: {
    type: String,
    enum: ["mg", "ml"],
    required: false,
  },
  quantityAvailable: {
    type: Number,
    required: true,
    min: 0,
  },
  totalStockInGramsOrMl: {
    type: Number,
    default: 0,
  },
  pricePerUnit: {
    type: Number,
    required: true,
  },
  expiryDate: {
    type: Date,
    required: true,
  },
  manufacturer: {
    type: String,
    required: false,
  },
  requiresPrescription: {
    type: Boolean,
    default: true,
  },
  medicineImage: {
    type: String, // image URL (optional)
    required: false,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ["available", "low-stock", "out-of-stock"],
    default: "available",
  }
});

// Enable text search on medicine and brand name
inventorySchema.index({ medicineName: "text", brandName: "text" });

// Auto-calculate total stock in grams/ml before save
inventorySchema.pre("save", function (next) {
  if (this.unitWeightOrVolume && this.quantityAvailable) {
    const multiplier = this.unitMeasurement === "mg" ? 0.001 : 1;
    this.totalStockInGramsOrMl = this.unitWeightOrVolume * this.quantityAvailable * multiplier;
  }
  next();
});

export const InventoryItem = mongoose.model("InventoryItem", inventorySchema);
