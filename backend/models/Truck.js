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
    weight: { type: Number, required: true }, 
    volume: { type: Number } 
  },
  dimensions: {
    length: Number, 
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
    type: String, 
    default: null
  },
  location: {
    address: String,
    coordinates: {
      type: {
        type: String,
        enum: ['Point']
      },
      coordinates: {
        type: [Number]
      }
    }
  },
  rates: {
    perKm: { type: Number, required: true }, 
    perHour: Number,
    minimumCharge: { type: Number, required: true }
  },
  availability: {
    isAvailable: { type: Boolean, default: true },
    availableFrom: Date,
    availableUntil: Date,
    workingDays: [String]
  },
  features: [String], 
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
truckSchema.index({ 'location.coordinates': '2dsphere' });
module.exports = mongoose.model('Truck', truckSchema);
