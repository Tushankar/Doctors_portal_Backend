import express from "express";
import { orderController } from "../controllers/orderController.js";
import { authorize as checkRole } from "../middleware/roleMiddleware.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @route   POST /api/v1/orders
 * @desc    Create a new order (when patient selects pharmacy)
 * @access  Private (Patient only)
 */
router.post("/", protect, checkRole(["patient"]), async (req, res, next) => {
  try {
    const { prescriptionId, pharmacyId, ...orderData } = req.body;
    const result = await orderController.createOrder(
      prescriptionId,
      req.user.id,
      pharmacyId,
      orderData
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/orders/:id
 * @desc    Get order by ID
 * @access  Private (Patient or Pharmacy)
 */
router.get("/:id", protect, async (req, res, next) => {
  try {
    const result = await orderController.getOrderById(
      req.params.id,
      req.user.id,
      req.user.role
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/orders
 * @desc    Get orders (filtered by user role)
 * @access  Private
 */
router.get("/", protect, async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    let result;
    if (req.user.role === "pharmacy") {
      result = await orderController.getOrdersByPharmacy(
        req.user.id,
        status,
        parseInt(page),
        parseInt(limit)
      );
    } else if (req.user.role === "patient") {
      result = await orderController.getOrdersByPatient(
        req.user.id,
        status,
        parseInt(page),
        parseInt(limit)
      );
    } else {
      throw new Error("Unauthorized role");
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PATCH /api/v1/orders/:id/status
 * @desc    Update order status
 * @access  Private (Pharmacy only)
 */
router.patch(
  "/:id/status",
  protect,
  checkRole(["pharmacy"]),
  async (req, res, next) => {
    try {
      const { status, notes } = req.body;
      const result = await orderController.updateOrderStatus(
        req.params.id,
        status,
        req.user.id,
        notes
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   PATCH /api/v1/orders/:id/items
 * @desc    Update order items and pricing
 * @access  Private (Pharmacy only)
 */
router.patch(
  "/:id/items",
  protect,
  checkRole(["pharmacy"]),
  async (req, res, next) => {
    try {
      const { items } = req.body;
      const result = await orderController.updateOrderItems(
        req.params.id,
        items,
        req.user.id
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   PATCH /api/v1/orders/:id/cancel
 * @desc    Cancel order
 * @access  Private (Patient or Pharmacy)
 */
router.patch("/:id/cancel", protect, async (req, res, next) => {
  try {
    const { reason } = req.body;
    const result = await orderController.cancelOrder(
      req.params.id,
      req.user.id,
      req.user.role,
      reason
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/orders/:id/history
 * @desc    Get order history/timeline
 * @access  Private (Patient or Pharmacy)
 */
router.get("/:id/history", protect, async (req, res, next) => {
  try {
    const result = await orderController.getOrderHistory(
      req.params.id,
      req.user.id,
      req.user.role
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/v1/orders/pharmacy/dashboard
 * @desc    Get pharmacy dashboard data (orders summary)
 * @access  Private (Pharmacy only)
 */
router.get(
  "/pharmacy/dashboard",
  protect,
  checkRole(["pharmacy"]),
  async (req, res, next) => {
    try {
      // Get orders summary for pharmacy dashboard
      const [placed, confirmed, preparing, ready, outForDelivery] =
        await Promise.all([
          orderController.getOrdersByPharmacy(req.user.id, "placed", 1, 100),
          orderController.getOrdersByPharmacy(req.user.id, "confirmed", 1, 100),
          orderController.getOrdersByPharmacy(req.user.id, "preparing", 1, 100),
          orderController.getOrdersByPharmacy(req.user.id, "ready", 1, 100),
          orderController.getOrdersByPharmacy(
            req.user.id,
            "out_for_delivery",
            1,
            100
          ),
        ]);

      const summary = {
        newOrders: placed.data.orders.length,
        confirmedOrders: confirmed.data.orders.length,
        preparingOrders: preparing.data.orders.length,
        readyOrders: ready.data.orders.length,
        outForDeliveryOrders: outForDelivery.data.orders.length,
        recentOrders: placed.data.orders.slice(0, 5), // Show latest 5 new orders
      };

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/v1/orders/by-prescription/:prescriptionId
 * @desc    Get order by prescription ID
 * @access  Private (Patient or Pharmacy)
 */
router.get(
  "/by-prescription/:prescriptionId",
  protect,
  async (req, res, next) => {
    try {
      console.log("=== GET ORDER BY PRESCRIPTION ROUTE ===");
      console.log("Prescription ID:", req.params.prescriptionId);
      console.log("User:", { id: req.user.id, role: req.user.role });

      const result = await orderController.getOrderByPrescriptionId(
        req.params.prescriptionId,
        req.user.id,
        req.user.role
      );

      console.log("Order found:", result);
      res.json(result);
    } catch (error) {
      console.error("Error in get order by prescription route:", error);
      next(error);
    }
  }
);

export default router;
