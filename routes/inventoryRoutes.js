import express from "express";
import {
  uploadInventoryCsv,
  addInventoryItem,
  getPharmacyInventory,
} from "../controllers/inventoryController.js";

import { protect } from "../middleware/authMiddleware.js";
import { authorize as checkRole } from "../middleware/roleMiddleware.js";

// Authenticate all pharmacy routes

import multer from "multer";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv") {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"), false);
    }
  },
});

const router = express.Router();
router.use(protect);

// Route for uploading CSV inventory file
router.post(
  "/:pharmacyId/inventory/upload-csv",
  checkRole("pharmacy"),
  upload.single("csvFile"),
  async (req, res, next) => {
    try {
      const { pharmacyId } = req.params;
      const userId = req.user.id; // Assuming user ID is available from auth middleware
      const file = req.file;

      if (!file) {
        return res
          .status(400)
          .json({ success: false, message: "No file uploaded" });
      }

      const result = await uploadInventoryCsv(pharmacyId, userId, file);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Route to get all inventory items
router.get(
  "/:pharmacyId/inventory",
  checkRole("pharmacy"),
  async (req, res, next) => {
    try {
      const { pharmacyId } = req.params;
      const result = await getPharmacyInventory(
        pharmacyId,
        req.user.id,
        req.query
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Route to add a single inventory item
router.post(
  "/:pharmacyId/inventory",
  checkRole("pharmacy"),
  async (req, res, next) => {
    try {
      const { pharmacyId } = req.params;
      const result = await addInventoryItem(pharmacyId, req.user.id, req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
