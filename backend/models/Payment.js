const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  trucker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  mpesaDetails: {
    merchantRequestID: String,
    checkoutRequestID: String,
    responseCode: String,
    responseDescription: String,
    customerMessage: String
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  escrowStatus: {
    type: String,
    enum: ['held', 'released', 'refunded'],
    default: 'held'
  },
  paymentMethod: {
    type: String,
    enum: ['mpesa', 'cash', 'bank'],
    default: 'mpesa'
  },
  transactionReference: String,
  paidAt: Date,
  releasedAt: Date,
  refundedAt: Date,
  refundReason: String
}, {
  timestamps: true
});

module.exports = mongoose.model('Payment', paymentSchema);

