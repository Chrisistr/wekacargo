const mongoose = require('mongoose');
const bookingSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  truck: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Truck',
    required: true
  },
  trucker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  origin: {
    address: { type: String, required: true },
    coordinates: {
      lat: Number,
      lng: Number
    },
    contact: String,
    pickupTime: Date
  },
  destination: {
    address: { type: String, required: true },
    coordinates: {
      lat: Number,
      lng: Number
    },
    contact: String,
    dropoffTime: Date
  },
  cargoDetails: {
    type: {
      type: String,
      required: true
    },
    weight: { type: Number, required: true }, 
    volume: Number,
    description: String,
    pictures: [String], 
    isDelicate: { type: Boolean, default: false } 
  },
  pricing: {
    distance: Number, 
    rate: Number, 
    estimatedAmount: Number,
    actualAmount: Number,
    cancellationFee: Number
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in-transit', 'completed', 'cancelled'],
    default: 'pending'
  },
  payment: {
    paymentId: mongoose.Schema.Types.ObjectId,
    status: {
      type: String,
      enum: ['pending', 'processing', 'paid', 'held', 'refunded'],
      default: 'pending'
    },
    method: String
  },
  tracking: {
    currentLocation: {
      lat: Number,
      lng: Number
    },
    lastUpdate: Date,
    estimatedArrival: Date
  },
  review: {
    rating: Number,
    comment: String,
    submitted: { type: Boolean, default: false }
  },
  specialInstructions: String,
  cancellationReason: String,
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancelledAt: Date
}, {
  timestamps: true
});
bookingSchema.index({ 'origin.coordinates': '2dsphere' });
bookingSchema.index({ 'destination.coordinates': '2dsphere' });
module.exports = mongoose.model('Booking', bookingSchema);
