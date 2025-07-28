import mongoose from "mongoose";
import { Order } from "../models/Order.js";
import { Prescription } from "../models/Prescription.js";
import Pharmacy from "../models/Pharmacy.js";
import Patient from "../models/Patient.js";

class OrderController {
  constructor() {
    this.createOrder = this.createOrder.bind(this);
    this.getOrderById = this.getOrderById.bind(this);
    this.getOrdersByPharmacy = this.getOrdersByPharmacy.bind(this);
    this.getOrdersByPatient = this.getOrdersByPatient.bind(this);
    this.updateOrderStatus = this.updateOrderStatus.bind(this);
    this.updateOrderItems = this.updateOrderItems.bind(this);
    this.cancelOrder = this.cancelOrder.bind(this);
    this.getOrderHistory = this.getOrderHistory.bind(this);
  }

  /**
   * Create a new order when patient selects a pharmacy
   */
  async createOrder(prescriptionId, patientId, pharmacyId, orderData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Verify prescription exists and is in correct status
      const prescription = await Prescription.findOne({
        _id: prescriptionId,
        patientId,
        status: "accepted",
      }).session(session);

      if (!prescription) {
        throw new Error("Prescription not found or not in accepted status");
      }

      // Verify pharmacy is selected for this prescription
      if (prescription.pharmacyId.toString() !== pharmacyId.toString()) {
        throw new Error("Pharmacy not selected for this prescription");
      }

      // Check if order already exists for this prescription
      const existingOrder = await Order.findOne({ prescriptionId }).session(
        session
      );
      if (existingOrder) {
        throw new Error("Order already exists for this prescription");
      }

      // Get pharmacy and patient details
      const [pharmacy, patient] = await Promise.all([
        Pharmacy.findById(pharmacyId).session(session),
        Patient.findById(patientId).session(session),
      ]);

      if (!pharmacy || !patient) {
        throw new Error("Pharmacy or patient not found");
      }

      // Create order items from prescription medications
      const orderItems =
        prescription.ocrData?.medications?.map((med) => ({
          medicationName: med.name,
          dosage: med.dosage,
          quantity: orderData.quantities?.[med.name] || 1,
          unitPrice: orderData.prices?.[med.name] || 0,
          totalPrice:
            (orderData.quantities?.[med.name] || 1) *
            (orderData.prices?.[med.name] || 0),
          notes: med.instructions,
        })) || [];

      // Calculate total amount
      const totalAmount = orderItems.reduce(
        (sum, item) => sum + item.totalPrice,
        0
      );

      // Create the order
      const order = new Order({
        prescriptionId,
        patientId,
        pharmacyId,
        orderType: orderData.orderType || "pickup",
        items: orderItems,
        totalAmount,
        deliveryInfo:
          orderData.orderType === "delivery"
            ? {
                address: orderData.deliveryAddress || patient.address,
                phoneNumber: orderData.phoneNumber || patient.phone,
                deliveryInstructions: orderData.deliveryInstructions,
                deliveryFee: orderData.deliveryFee || 0,
              }
            : undefined,
        pickupInfo:
          orderData.orderType === "pickup"
            ? {
                pickupInstructions: orderData.pickupInstructions,
              }
            : undefined,
        paymentInfo: {
          method: orderData.paymentMethod || "cash",
          status: "pending",
        },
        patientNotes: orderData.patientNotes,
        specialInstructions: orderData.specialInstructions,
        isUrgent: orderData.isUrgent || false,
        statusHistory: [
          {
            status: "placed",
            timestamp: new Date(),
            updatedBy: patientId,
            notes: "Order placed by patient",
          },
        ],
      });

      await order.save({ session });

      // Update prescription status
      prescription.status = "accepted"; // Keep as accepted since order is now created
      await prescription.save({ session });

      await session.commitTransaction();

      // Populate the order for response
      await order.populate([
        { path: "patientId", select: "firstName lastName email phone" },
        { path: "pharmacyId", select: "pharmacyName contactInfo address" },
        { path: "prescriptionId", select: "description ocrData.medications" },
      ]);

      return {
        success: true,
        message: "Order created successfully",
        data: order,
      };
    } catch (error) {
      await session.abortTransaction();
      throw new Error(error.message || "Failed to create order");
    } finally {
      session.endSession();
    }
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId, userId, userRole) {
    try {
      let query = { _id: orderId };

      // Add authorization based on user role
      if (userRole === "patient") {
        query.patientId = userId;
      } else if (userRole === "pharmacy") {
        const pharmacy = await Pharmacy.findOne({ userId });
        if (!pharmacy) throw new Error("Pharmacy not found");
        query.pharmacyId = pharmacy._id;
      }

      const order = await Order.findOne(query)
        .populate("patientId", "firstName lastName email phone address")
        .populate("pharmacyId", "pharmacyName contactInfo address")
        .populate(
          "prescriptionId",
          "description ocrData createdAt uploadedAt validationResults"
        )
        .populate("statusHistory.updatedBy", "firstName lastName email");

      if (!order) {
        throw new Error("Order not found or unauthorized");
      }

      return {
        success: true,
        data: order,
      };
    } catch (error) {
      throw new Error(error.message || "Failed to get order");
    }
  }

  /**
   * Get orders for a pharmacy
   */
  async getOrdersByPharmacy(userId, status = null, page = 1, limit = 10) {
    try {
      console.log(
        `[GET_PHARMACY_ORDERS] Looking for pharmacy with userId: ${userId}`
      );

      // Get pharmacy from user - FIXED: Use correct field name
      const pharmacy = await Pharmacy.findOne({ userId: userId });
      if (!pharmacy) {
        console.log(
          `[GET_PHARMACY_ORDERS] No pharmacy found for userId: ${userId}`
        );

        // Try alternative lookup in case userId field is stored differently
        const pharmacyAlt = await Pharmacy.findById(userId);
        if (!pharmacyAlt) {
          console.log(
            `[GET_PHARMACY_ORDERS] No pharmacy found with _id: ${userId} either`
          );
          throw new Error("Pharmacy not found");
        }
        console.log(
          `[GET_PHARMACY_ORDERS] Found pharmacy by _id: ${pharmacyAlt._id} (${pharmacyAlt.pharmacyName})`
        );

        // Use the alternative pharmacy
        const query = { pharmacyId: pharmacyAlt._id };
        if (status) query.status = status;

        console.log(`[GET_PHARMACY_ORDERS] Query:`, query);

        const skip = (page - 1) * limit;
        const [orders, totalCount] = await Promise.all([
          Order.find(query)
            .populate("patientId", "firstName lastName email phone address")
            .populate(
              "prescriptionId",
              "description ocrData createdAt uploadedAt validationResults"
            )
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
          Order.countDocuments(query),
        ]);

        console.log(
          `[GET_PHARMACY_ORDERS] Found ${orders.length} orders out of ${totalCount} total`
        );

        return {
          success: true,
          data: {
            orders,
            pagination: {
              page,
              limit,
              total: totalCount,
              pages: Math.ceil(totalCount / limit),
            },
          },
        };
      }

      console.log(
        `[GET_PHARMACY_ORDERS] Found pharmacy: ${pharmacy._id} (${pharmacy.pharmacyName})`
      );

      // Build query
      const query = { pharmacyId: pharmacy._id };
      if (status) query.status = status;

      console.log(`[GET_PHARMACY_ORDERS] Query:`, query);

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Get orders with better sorting and limit handling
      const [orders, totalCount] = await Promise.all([
        Order.find(query)
          .populate("patientId", "firstName lastName email phone address")
          .populate(
            "prescriptionId",
            "description ocrData createdAt uploadedAt validationResults"
          )
          .sort({ createdAt: -1 }) // Most recent first
          .skip(skip)
          .limit(parseInt(limit)), // Ensure limit is integer
        Order.countDocuments(query),
      ]);

      console.log(
        `[GET_PHARMACY_ORDERS] Found ${orders.length} orders out of ${totalCount} total`
      );
      console.log(
        `[GET_PHARMACY_ORDERS] Orders IDs:`,
        orders.map((o) => o._id)
      );

      return {
        success: true,
        data: {
          orders,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalCount,
            pages: Math.ceil(totalCount / parseInt(limit)),
          },
        },
      };
    } catch (error) {
      console.error(`[GET_PHARMACY_ORDERS] Error: ${error.message}`);
      throw new Error(error.message || "Failed to get pharmacy orders");
    }
  }

  /**
   * Get orders for a patient
   */
  async getOrdersByPatient(patientId, status = null, page = 1, limit = 10) {
    try {
      // Build query
      const query = { patientId };
      if (status) query.status = status;

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Get orders
      const [orders, totalCount] = await Promise.all([
        Order.find(query)
          .populate("pharmacyId", "pharmacyName contactInfo address")
          .populate(
            "prescriptionId",
            "description ocrData createdAt uploadedAt validationResults"
          )
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Order.countDocuments(query),
      ]);

      return {
        success: true,
        data: {
          orders,
          pagination: {
            page,
            limit,
            total: totalCount,
            pages: Math.ceil(totalCount / limit),
          },
        },
      };
    } catch (error) {
      throw new Error(error.message || "Failed to get patient orders");
    }
  }

  /**
   * Update order status (pharmacy only)
   */
  async updateOrderStatus(orderId, newStatus, userId, notes = "") {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Get pharmacy from user
      const pharmacy = await Pharmacy.findOne({ userId }).session(session);
      if (!pharmacy) throw new Error("Pharmacy not found");

      // Find the order
      const order = await Order.findOne({
        _id: orderId,
        pharmacyId: pharmacy._id,
      }).session(session);

      if (!order) {
        throw new Error("Order not found or unauthorized");
      }

      // Validate status transition
      this.validateStatusTransition(order.status, newStatus);

      // Update status and relevant timestamps
      const oldStatus = order.status;
      order.status = newStatus;
      order.lastUpdatedBy = userId;
      order.lastStatusNote = notes;

      // Set specific timestamps based on status
      const now = new Date();
      switch (newStatus) {
        case "confirmed":
          order.confirmedAt = now;
          break;
        case "preparing":
          if (!order.confirmedAt) order.confirmedAt = now;
          break;
        case "ready":
          order.readyAt = now;
          break;
        case "delivered":
          order.deliveredAt = now;
          break;
        case "cancelled":
          order.cancelledAt = now;
          break;
      }

      await order.save({ session });

      // Update prescription status based on order status
      if (newStatus === "delivered") {
        await Prescription.findByIdAndUpdate(
          order.prescriptionId,
          { status: "delivered" },
          { session }
        );
      }

      await session.commitTransaction();

      // Populate for response
      await order.populate([
        { path: "patientId", select: "firstName lastName email phone" },
        { path: "prescriptionId", select: "description" },
      ]);

      return {
        success: true,
        message: `Order status updated from ${oldStatus} to ${newStatus}`,
        data: order,
      };
    } catch (error) {
      await session.abortTransaction();
      throw new Error(error.message || "Failed to update order status");
    } finally {
      session.endSession();
    }
  }

  /**
   * Update order items and pricing (pharmacy only)
   */
  async updateOrderItems(orderId, items, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Get pharmacy from user
      const pharmacy = await Pharmacy.findOne({ userId }).session(session);
      if (!pharmacy) throw new Error("Pharmacy not found");

      // Find the order
      const order = await Order.findOne({
        _id: orderId,
        pharmacyId: pharmacy._id,
      }).session(session);

      if (!order) {
        throw new Error("Order not found or unauthorized");
      }

      // Only allow updates if order is in placed or confirmed status
      if (!["placed", "confirmed"].includes(order.status)) {
        throw new Error("Cannot update items for orders in current status");
      }

      // Update items
      order.items = items;
      order.totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);

      await order.save({ session });
      await session.commitTransaction();

      return {
        success: true,
        message: "Order items updated successfully",
        data: order,
      };
    } catch (error) {
      await session.abortTransaction();
      throw new Error(error.message || "Failed to update order items");
    } finally {
      session.endSession();
    }
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId, userId, userRole, reason = "") {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      let query = { _id: orderId };

      // Add authorization based on user role
      if (userRole === "patient") {
        query.patientId = userId;
      } else if (userRole === "pharmacy") {
        const pharmacy = await Pharmacy.findOne({ userId }).session(session);
        if (!pharmacy) throw new Error("Pharmacy not found");
        query.pharmacyId = pharmacy._id;
      }

      const order = await Order.findOne(query).session(session);
      if (!order) {
        throw new Error("Order not found or unauthorized");
      }

      // Check if order can be cancelled
      if (["delivered", "cancelled"].includes(order.status)) {
        throw new Error("Cannot cancel order in current status");
      }

      // Update order status
      order.status = "cancelled";
      order.cancelledAt = new Date();
      order.lastUpdatedBy = userId;
      order.lastStatusNote = reason;

      await order.save({ session });

      // Update prescription status back to processed to allow reselection
      await Prescription.findByIdAndUpdate(
        order.prescriptionId,
        { status: "processed", pharmacyId: null },
        { session }
      );

      await session.commitTransaction();

      return {
        success: true,
        message: "Order cancelled successfully",
        data: order,
      };
    } catch (error) {
      await session.abortTransaction();
      throw new Error(error.message || "Failed to cancel order");
    } finally {
      session.endSession();
    }
  }

  /**
   * Get order history/timeline
   */
  async getOrderHistory(orderId, userId, userRole) {
    try {
      const orderData = await this.getOrderById(orderId, userId, userRole);
      const order = orderData.data;

      return {
        success: true,
        data: {
          orderNumber: order.orderNumber,
          currentStatus: order.status,
          statusHistory: order.statusHistory,
          timeline: this.generateOrderTimeline(order),
        },
      };
    } catch (error) {
      throw new Error(error.message || "Failed to get order history");
    }
  }

  /**
   * Helper method to validate status transitions
   */
  validateStatusTransition(currentStatus, newStatus) {
    const validTransitions = {
      placed: ["confirmed", "cancelled", "on_hold"],
      confirmed: ["preparing", "cancelled", "on_hold"],
      preparing: ["ready", "cancelled", "on_hold"],
      ready: ["out_for_delivery", "delivered", "cancelled"],
      out_for_delivery: ["delivered", "cancelled"],
      on_hold: ["confirmed", "preparing", "cancelled"],
      delivered: [], // Final state
      cancelled: [], // Final state
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new Error(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  /**
   * Helper method to generate order timeline
   */
  generateOrderTimeline(order) {
    const timeline = [];
    const statusMap = {
      placed: { label: "Order Placed", icon: "🛒" },
      confirmed: { label: "Order Confirmed", icon: "✅" },
      preparing: { label: "Preparing Medications", icon: "⚗️" },
      ready: { label: "Ready for Pickup/Delivery", icon: "📦" },
      out_for_delivery: { label: "Out for Delivery", icon: "🚛" },
      delivered: { label: "Delivered", icon: "🎉" },
      cancelled: { label: "Cancelled", icon: "❌" },
      on_hold: { label: "On Hold", icon: "⏸️" },
    };

    order.statusHistory.forEach((history) => {
      timeline.push({
        status: history.status,
        label: statusMap[history.status]?.label || history.status,
        icon: statusMap[history.status]?.icon || "📋",
        timestamp: history.timestamp,
        notes: history.notes,
        updatedBy: history.updatedBy,
      });
    });

    return timeline.sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
  }
}

export const orderController = new OrderController();
