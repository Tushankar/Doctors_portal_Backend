// Sample Pharmacy Data for Testing
// This data can be inserted into MongoDB for testing purposes

const samplePharmacies = [
  {
    pharmacyName: "Apollo Pharmacy",
    address: {
      street: "123 MG Road",
      city: "Bangalore",
      state: "Karnataka",
      zipCode: "560001",
      country: "India",
    },
    location: {
      type: "Point",
      coordinates: [77.5946, 12.9716], // Bangalore coordinates
    },
    contactInfo: {
      phone: "080-12345678",
      email: "bangalore@apollopharmacy.in",
    },
    operatingHours: {
      monday: { open: "08:00", close: "22:00", closed: false },
      tuesday: { open: "08:00", close: "22:00", closed: false },
      wednesday: { open: "08:00", close: "22:00", closed: false },
      thursday: { open: "08:00", close: "22:00", closed: false },
      friday: { open: "08:00", close: "22:00", closed: false },
      saturday: { open: "08:00", close: "22:00", closed: false },
      sunday: { open: "09:00", close: "21:00", closed: false },
    },
    services: ["prescription_filling", "consultation", "home_delivery"],
    deliveryAvailable: true,
    deliveryRadius: 10,
  },
  {
    pharmacyName: "MedPlus Pharmacy",
    address: {
      street: "456 Brigade Road",
      city: "Bangalore",
      state: "Karnataka",
      zipCode: "560025",
      country: "India",
    },
    location: {
      type: "Point",
      coordinates: [77.6088, 12.973], // Bangalore coordinates
    },
    contactInfo: {
      phone: "080-87654321",
      email: "brigade@medplus.in",
    },
    operatingHours: {
      monday: { open: "09:00", close: "21:00", closed: false },
      tuesday: { open: "09:00", close: "21:00", closed: false },
      wednesday: { open: "09:00", close: "21:00", closed: false },
      thursday: { open: "09:00", close: "21:00", closed: false },
      friday: { open: "09:00", close: "21:00", closed: false },
      saturday: { open: "09:00", close: "21:00", closed: false },
      sunday: { open: "10:00", close: "20:00", closed: false },
    },
    services: ["prescription_filling", "medication_therapy_management"],
    deliveryAvailable: true,
    deliveryRadius: 8,
  },
  {
    pharmacyName: "1mg Pharmacy",
    address: {
      street: "789 Koramangala",
      city: "Bangalore",
      state: "Karnataka",
      zipCode: "560034",
      country: "India",
    },
    location: {
      type: "Point",
      coordinates: [77.6309, 12.9279], // Bangalore coordinates
    },
    contactInfo: {
      phone: "080-55443322",
      email: "koramangala@1mg.com",
    },
    operatingHours: {
      monday: { open: "24:00", close: "24:00", closed: false },
      tuesday: { open: "24:00", close: "24:00", closed: false },
      wednesday: { open: "24:00", close: "24:00", closed: false },
      thursday: { open: "24:00", close: "24:00", closed: false },
      friday: { open: "24:00", close: "24:00", closed: false },
      saturday: { open: "24:00", close: "24:00", closed: false },
      sunday: { open: "24:00", close: "24:00", closed: false },
    },
    services: ["prescription_filling", "home_delivery", "consultation"],
    deliveryAvailable: true,
    deliveryRadius: 15,
  },
];

// MongoDB insertion script
// Run this in MongoDB Compass or mongo shell
/*
db.pharmacies.insertMany([
  // Insert the samplePharmacies array here
]);
*/

module.exports = samplePharmacies;
