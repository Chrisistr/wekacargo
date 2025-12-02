const mongoose = require('mongoose');

const truckSchema = new mongoose.Schema({
  trucker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['pickup', 'lorry', 'truck', 'container', 'flatbed'],
    required: true
  },
  capacity: {
    weight: { type: Number, required: true }, // in tons
    volume: { type: Number } // in cubic meters
  },
  dimensions: {
    length: Number, // in meters
    width: Number,
    height: Number
  },
  registrationNumber: {
    type: String,
    required: true,
    unique: true
  },
  photos: [String],
  proofOfOwnership: {
    type: String, // URL or base64 string for proof of ownership document
    default: null
  },
  location: {
    address: String,
    coordinates: {
      type: {
        type: String,
        enum: ['Point']
      },
      // [lng, lat] for MongoDB geospatial queries
      // This field is optional – only set when we actually have coordinates
      coordinates: {
        type: [Number]
      }
    }
  },
  rates: {
    perKm: { type: Number, required: true }, // KES per km
    perHour: Number,
    minimumCharge: { type: Number, required: true }
  },
  availability: {
    isAvailable: { type: Boolean, default: true },
    availableFrom: Date,
    availableUntil: Date,
    workingDays: [String]
  },
  features: [String], // e.g., ["GPS", "Refrigeration", "Crane"]
  insurance: {
    insured: { type: Boolean, default: false },
    expiryDate: Date
  },
  rating: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 }
  },
  status: {
    type: String,
    enum: ['active', 'maintenance', 'inactive'],
    default: 'active'
  },
  activityLog: [{
    action: { type: String, required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    metadata: mongoose.Schema.Types.Mixed,
    timestamp: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

// Create geospatial index for location queries
truckSchema.index({ 'location.coordinates': '2dsphere' });

module.exports = mongoose.model('Truck', truckSchema);

