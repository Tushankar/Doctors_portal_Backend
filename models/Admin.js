import mongoose from 'mongoose';
import User from './User.js';

const adminSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'Please provide first name']
  },
  lastName: {
    type: String,
    required: [true, 'Please provide last name']
  },
  phone: {
    type: String,
    required: [true, 'Please provide phone number']
  },
  permissions: [{
    type: String,
    enum: [
      'manage_users',
      'manage_pharmacies',
      'manage_patients',
      'view_transactions',
      'manage_settings',
      'view_analytics'
    ]
  }],
  isSuperAdmin: {
    type: Boolean,
    default: false
  },
  lastLogin: Date
});

const Admin = User.discriminator('admin', adminSchema);
export default Admin;