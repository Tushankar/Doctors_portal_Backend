import mongoose from "mongoose";
const Schema = mongoose.Schema;

// Pharmacy schema definition
const PharmacySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      unique: true,
    },

    pharmacyName: {
      type: String,
      required: [true, "Pharmacy name is required"],
      trim: true,
      maxlength: [200, "Pharmacy name cannot exceed 200 characters"],
    },
    typeOfPharmacy: {
      type: String,
      required: [true, "Type of pharmacy is required"],
      trim: true,
      enum: [
        "retail",
        "hospital",
        "clinical",
        "compounding",
        "specialty",
        "online",
        "other",
      ],
    },

    licenseNumber: {
      type: String,
      required: [true, "License number is required"],
      trim: true,
      unique: true,
      maxlength: [50, "License number cannot exceed 50 characters"],
    },

    registeredPharmacist: {
      type: String,
      required: [true, "Registered pharmacist name is required"],
      trim: true,
      maxlength: [100, "Pharmacist name cannot exceed 100 characters"],
    },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: [true, "Location coordinates are required"],
        validate: {
          validator: function (coordinates) {
            return (
              coordinates.length === 2 &&
              coordinates[0] >= -180 &&
              coordinates[0] <= 180 && // longitude
              coordinates[1] >= -90 &&
              coordinates[1] <= 90
            ); // latitude
          },
          message:
            "Invalid coordinates. Longitude must be between -180 and 180, latitude between -90 and 90",
        },
      },
    },

    address: {
      street: {
        type: String,
        required: [true, "Street address is required"],
        trim: true,
      },
      city: {
        type: String,
        required: [true, "City is required"],
        trim: true,
      },
      state: {
        type: String,
        required: [true, "State is required"],
        trim: true,
      },
      zipCode: {
        type: String,
        required: [true, "ZIP code is required"],
        trim: true,
      },
      country: {
        type: String,
        required: [true, "Country is required"],
        trim: true,
        default: "United States",
      },
    },

    contactInfo: {
      phone: {
        type: String,
        required: [true, "Phone number is required"],
        match: [
          /^\+?[\d\s\-\(\)]{10,}$/,
          "Please provide a valid phone number",
        ],
      },
      email: {
        type: String,
        required: [true, "Email is required"],
        lowercase: true,
        trim: true,
        match: [
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          "Please provide a valid email address",
        ],
      },
      website: {
        type: String,
        trim: true,
        match: [/^https?:\/\/.+/, "Please provide a valid website URL"],
      },
      fax: {
        type: String,
        trim: true,
        match: [/^\+?[\d\s\-\(\)]{10,}$/, "Please provide a valid fax number"],
      },
    },

    operatingHours: {
      monday: {
        open: { type: String, default: "09:00" },
        close: { type: String, default: "18:00" },
        closed: { type: Boolean, default: false },
      },
      tuesday: {
        open: { type: String, default: "09:00" },
        close: { type: String, default: "18:00" },
        closed: { type: Boolean, default: false },
      },
      wednesday: {
        open: { type: String, default: "09:00" },
        close: { type: String, default: "18:00" },
        closed: { type: Boolean, default: false },
      },
      thursday: {
        open: { type: String, default: "09:00" },
        close: { type: String, default: "18:00" },
        closed: { type: Boolean, default: false },
      },
      friday: {
        open: { type: String, default: "09:00" },
        close: { type: String, default: "18:00" },
        closed: { type: Boolean, default: false },
      },
      saturday: {
        open: { type: String, default: "09:00" },
        close: { type: String, default: "17:00" },
        closed: { type: Boolean, default: false },
      },
      sunday: {
        open: { type: String, default: "10:00" },
        close: { type: String, default: "16:00" },
        closed: { type: Boolean, default: true },
      },
    },

    services: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
          enum: [
            "prescription_filling",
            "medication_therapy_management",
            "compounding",
            "vaccination",
            "home_delivery",
            "consultation",
            "other",
          ],
        },
        description: {
          type: String,
          trim: true,
        },
        available: {
          type: Boolean,
          default: true,
        },
      },
    ],

    documents: [
      {
        type: {
          type: String,
          enum: ["license", "certification", "insurance", "other"],
          required: true,
        },
        filename: {
          type: String,
          required: true,
        },
        originalName: {
          type: String,
          required: true,
        },
        cloudinaryUrl: {
          type: String,
          required: true,
        },
        cloudinaryPublicId: {
          type: String,
          required: true,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
        verified: {
          type: Boolean,
          default: false,
        },
        verifiedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        verifiedAt: Date,
        notes: {
          type: String,
          trim: true,
        },
      },
    ],

    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended"],
      default: "pending",
    },

    approvalNotes: {
      type: String,
      trim: true,
    },

    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    approvedAt: Date,

    rejectedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    rejectedAt: Date,

    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Geospatial index for location-based queries
PharmacySchema.index({ location: "2dsphere" });

// Other indexes for performance
PharmacySchema.index({ userId: 1 });
PharmacySchema.index({ licenseNumber: 1 });
PharmacySchema.index({ approvalStatus: 1 });
PharmacySchema.index({ isActive: 1 });
PharmacySchema.index({ rating: -1 });
PharmacySchema.index({ createdAt: -1 });
PharmacySchema.index({ "address.city": 1, "address.state": 1 });

// Compound indexes for common queries
PharmacySchema.index({ approvalStatus: 1, isActive: 1 });
PharmacySchema.index({ location: "2dsphere", approvalStatus: 1, isActive: 1 });

// Virtual for full address
PharmacySchema.virtual("fullAddress").get(function () {
  return `${this.address.street}, ${this.address.city}, ${this.address.state} ${this.address.zipCode}`;
});

// Static method to find nearby pharmacies
PharmacySchema.statics.findNearby = function (
  longitude,
  latitude,
  maxDistance = 10000
) {
  return this.find({
    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
        $maxDistance: maxDistance,
      },
    },
    approvalStatus: "approved",
    isActive: true,
  });
};

// Static method to find pharmacies within a radius
PharmacySchema.statics.findWithinRadius = function (
  longitude,
  latitude,
  radiusInMeters
) {
  return this.find({
    location: {
      $geoWithin: {
        $centerSphere: [[longitude, latitude], radiusInMeters / 6378100], // Earth radius in meters
      },
    },
    approvalStatus: "approved",
    isActive: true,
  });
};

// Instance method to check if pharmacy is currently open
PharmacySchema.methods.isCurrentlyOpen = function () {
  const now = new Date();
  const dayOfWeek = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ][now.getDay()];
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

  const todayHours = this.operatingHours[dayOfWeek];

  if (todayHours.closed) {
    return false;
  }

  return currentTime >= todayHours.open && currentTime <= todayHours.close;
};

// Instance method to calculate distance from a point
PharmacySchema.methods.distanceFrom = function (longitude, latitude) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((latitude - this.location.coordinates[1]) * Math.PI) / 180;
  const dLon = ((longitude - this.location.coordinates[0]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((this.location.coordinates[1] * Math.PI) / 180) *
      Math.cos((latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
};

// Create and export the Pharmacy model
export default mongoose.model("Pharmacy", PharmacySchema);
