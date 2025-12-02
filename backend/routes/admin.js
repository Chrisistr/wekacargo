const express = require('express');
const router = express.Router();
const User = require('../models/User');
const RemovalRequest = require('../models/RemovalRequest');
const Alert = require('../models/Alert');
const Truck = require('../models/Truck');
const { auth, authorize } = require('../middleware/auth');

// Admin-only middleware
router.use(auth, authorize('admin'));

// Get all users (with optional search and role filter)
router.get('/users', async (req, res) => {
  try {
    const { search, role } = req.query;
    let query = {};

    // Filter by role if provided
    if (role && role !== 'all') {
      query.role = role;
    }

    // Search by name, email, or phone if search term provided
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user by ID with full details (for admin)
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('trucks')
      .lean();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's bookings
    const Booking = require('../models/Booking');
    const bookings = await Booking.find({
      $or: [
        { customer: user._id },
        { trucker: user._id }
      ]
    })
      .populate('customer', 'name email phone')
      .populate('trucker', 'name email phone')
      .populate('truck', 'type registrationNumber')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Get user's trucks if trucker
    let trucks = [];
    if (user.role === 'trucker') {
      const Truck = require('../models/Truck');
      trucks = await Truck.find({ trucker: user._id })
        .populate('trucker', 'name email phone')
        .sort({ createdAt: -1 })
        .lean();
    }

    res.json({
      ...user,
      bookings,
      trucks
    });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user status
router.put('/users/:id', async (req, res) => {
  try {
    const { status, verification } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent admin account suspension
    if (status && user.role === 'admin' && status !== 'active') {
      return res.status(403).json({ message: 'Admin accounts cannot be suspended or banned' });
    }

    if (status) {
      user.status = status;
    }

    if (verification) {
      user.verification = { ...user.verification, ...verification };
    }

    await user.save();

    res.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get system analytics
router.get('/analytics', async (req, res) => {
  try {
    const Booking = require('../models/Booking');
    const Payment = require('../models/Payment');

    const totalUsers = await User.countDocuments();
    const truckers = await User.countDocuments({ role: 'trucker' });
    const customers = await User.countDocuments({ role: 'customer' });
    const trucks = await Truck.countDocuments();
    const bookings = await Booking.countDocuments();
    const completedBookings = await Booking.countDocuments({ status: 'completed' });
    const totalRevenue = await Payment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Get escrow funds summary
    const escrowSummary = await Payment.aggregate([
      {
        $group: {
          _id: '$escrowStatus',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const escrowFunds = {
      held: escrowSummary.find(s => s._id === 'held')?.total || 0,
      released: escrowSummary.find(s => s._id === 'released')?.total || 0,
      refunded: escrowSummary.find(s => s._id === 'refunded')?.total || 0
    };

    res.json({
      users: { total: totalUsers, truckers, customers },
      trucks,
      bookings: { total: bookings, completed: completedBookings },
      revenue: totalRevenue[0]?.total || 0,
      escrow: {
        held: escrowFunds.held,
        released: escrowFunds.released,
        refunded: escrowFunds.refunded,
        totalInSystem: escrowFunds.held + escrowFunds.released
      }
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all payments with details (for admin financial overview)
router.get('/payments', async (req, res) => {
  try {
    const Payment = require('../models/Payment');
    const Booking = require('../models/Booking');
    const { status, escrowStatus, search, page = 1, limit = 50 } = req.query;

    let query = {};
    
    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Filter by escrow status
    if (escrowStatus && escrowStatus !== 'all') {
      query.escrowStatus = escrowStatus;
    }

    // Search by customer name, trucker name, or booking ID
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      const matchingUsers = await User.find({
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { phone: searchRegex }
        ]
      }).select('_id');
      
      const userIds = matchingUsers.map(u => u._id);
      const matchingBookings = await Booking.find({
        $or: [
          { 'origin.address': searchRegex },
          { 'destination.address': searchRegex }
        ]
      }).select('_id');
      
      const bookingIds = matchingBookings.map(b => b._id);
      
      query.$or = [
        { customer: { $in: userIds } },
        { trucker: { $in: userIds } },
        { booking: { $in: bookingIds } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const payments = await Payment.find(query)
      .populate('customer', 'name email phone')
      .populate('trucker', 'name email phone')
      .populate({
        path: 'booking',
        select: 'origin destination cargoDetails pricing status createdAt',
        populate: {
          path: 'truck',
          select: 'type registrationNumber'
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Payment.countDocuments(query);

    res.json({
      payments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get escrow funds summary (total held, released, refunded)
router.get('/payments/escrow-summary', async (req, res) => {
  try {
    const Payment = require('../models/Payment');

    const summary = await Payment.aggregate([
      {
        $group: {
          _id: '$escrowStatus',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Also get total by payment status
    const statusSummary = await Payment.aggregate([
      {
        $group: {
          _id: '$status',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Format results
    const escrowBreakdown = {
      held: { total: 0, count: 0 },
      released: { total: 0, count: 0 },
      refunded: { total: 0, count: 0 }
    };

    summary.forEach(item => {
      if (escrowBreakdown[item._id]) {
        escrowBreakdown[item._id] = {
          total: item.totalAmount,
          count: item.count
        };
      }
    });

    const statusBreakdown = {
      pending: { total: 0, count: 0 },
      processing: { total: 0, count: 0 },
      completed: { total: 0, count: 0 },
      failed: { total: 0, count: 0 },
      cancelled: { total: 0, count: 0 },
      refunded: { total: 0, count: 0 }
    };

    statusSummary.forEach(item => {
      if (statusBreakdown[item._id]) {
        statusBreakdown[item._id] = {
          total: item.totalAmount,
          count: item.count
        };
      }
    });

    res.json({
      escrow: escrowBreakdown,
      status: statusBreakdown,
      totals: {
        totalFundsInSystem: escrowBreakdown.held.total + escrowBreakdown.released.total,
        totalHeldInEscrow: escrowBreakdown.held.total,
        totalReleased: escrowBreakdown.released.total,
        totalRefunded: escrowBreakdown.refunded.total
      }
    });
  } catch (error) {
    console.error('Get escrow summary error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get payment details by ID (with full booking and user info)
router.get('/payments/:id', async (req, res) => {
  try {
    const Payment = require('../models/Payment');
    
    const payment = await Payment.findById(req.params.id)
      .populate('customer', 'name email phone location')
      .populate('trucker', 'name email phone location')
      .populate({
        path: 'booking',
        populate: {
          path: 'truck',
          select: 'type registrationNumber capacity rates'
        }
      });

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    res.json(payment);
  } catch (error) {
    console.error('Get payment details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve refund request (admin approval for refunds)
router.post('/payments/:id/approve-refund', async (req, res) => {
  try {
    const Payment = require('../models/Payment');
    const Booking = require('../models/Booking');
    const { refundReason, adminNote } = req.body;

    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    const booking = await Booking.findById(payment.booking);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check if payment can be refunded
    if (payment.status === 'refunded') {
      return res.status(400).json({ message: 'Payment has already been refunded' });
    }

    if (payment.escrowStatus === 'released') {
      return res.status(400).json({ 
        message: 'Payment was already released to trucker. Manual refund processing required.',
        requiresManualProcessing: true
      });
    }

    // Process refund
    payment.status = 'refunded';
    payment.escrowStatus = 'refunded';
    payment.refundedAt = new Date();
    payment.refundReason = refundReason || `Refund approved by admin: ${adminNote || 'No additional notes'}`;
    await payment.save();

    // Update booking payment status
    if (booking.payment && booking.payment.paymentId && booking.payment.paymentId.toString() === payment._id.toString()) {
      booking.payment.status = 'refunded';
      await booking.save();
    }

    // Create notification for customer
    try {
      const Notification = require('../models/Notification');
      await Notification.create({
        user: payment.customer,
        type: 'system',
        title: 'Payment Refund Approved',
        message: `Your refund of KES ${payment.amount.toLocaleString()} has been approved and processed. ${adminNote ? `Admin note: ${adminNote}` : ''}`,
        relatedBooking: booking._id
      });
    } catch (notifError) {
      console.error('Failed to create refund notification:', notifError);
    }

    // Populate payment for response
    await payment.populate('customer', 'name email phone');
    await payment.populate('trucker', 'name email phone');
    await payment.populate('booking');

    console.log(`✓ Admin approved refund: Payment ${payment._id}, Amount: KES ${payment.amount}, Approved by: ${req.user.name || req.user.email}`);

    res.json({ 
      message: 'Refund approved and processed successfully',
      payment
    });
  } catch (error) {
    console.error('Approve refund error:', error);
    res.status(500).json({ message: 'Failed to approve refund' });
  }
});

// --- Truck removal requests management ---

// Get removal requests (optionally filter by status)
router.get('/removal-requests', async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) {
      query.status = status;
    }

    const requests = await RemovalRequest.find(query)
      .sort({ createdAt: -1 })
      .populate('truck', 'type registrationNumber capacity rates location photos availability')
      .populate('trucker', 'name phone email location profile rating');

    res.json(requests);
  } catch (error) {
    console.error('Get removal requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a removal request (approve only - cannot be denied)
router.put('/removal-requests/:id', async (req, res) => {
  try {
    const { adminNote } = req.body;

    const request = await RemovalRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Removal request not found' });
    }

    // Only allow approval, not rejection
    if (request.status === 'pending') {
      request.status = 'approved';
      
      // If approved, mark truck as inactive and unavailable
      const truck = await Truck.findById(request.truck);
      if (truck) {
        truck.status = 'inactive';
        if (truck.availability) {
          truck.availability.isAvailable = false;
        }
        await truck.save();
      }
    }
    
    if (adminNote) {
      request.adminNote = adminNote;
    }

    await request.save();

    // Populate trucker and truck details for response
    await request.populate('truck', 'type registrationNumber capacity rates location photos availability');
    await request.populate('trucker', 'name phone email location profile rating');

    res.json(request);
  } catch (error) {
    console.error('Update removal request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- Alerts management ---

// Get all alerts (optionally filter by status)
router.get('/alerts', async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) {
      query.status = status;
    }

    const alerts = await Alert.find(query)
      .sort({ createdAt: -1 })
      .populate('user', 'name email phone role');

    res.json(alerts);
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update alert status
router.put('/alerts/:id', async (req, res) => {
  try {
    const { status } = req.body;

    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    if (status && ['open', 'in_progress', 'resolved'].includes(status)) {
      alert.status = status;
    }

    await alert.save();
    res.json(alert);
  } catch (error) {
    console.error('Update alert error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

