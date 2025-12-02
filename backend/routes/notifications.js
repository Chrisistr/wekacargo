const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { auth } = require('../middleware/auth');

// Get all notifications for current user
router.get('/', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .populate('relatedBooking')
      .populate('relatedUser', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get unread notifications count
router.get('/unread-count', auth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ 
      user: req.user.id, 
      read: false 
    });
    res.json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark notification as read
router.patch('/:id/read', auth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    if (notification.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    notification.read = true;
    notification.readAt = new Date();
    await notification.save();

    res.json(notification);
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark all notifications as read
router.patch('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, read: false },
      { read: true, readAt: new Date() }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete notification
router.delete('/:id', auth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    if (notification.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await notification.deleteOne();
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send message to trucker (customer to trucker communication)
router.post('/send-message', auth, async (req, res) => {
  try {
    const { truckerId, bookingId, message } = req.body;

    if (!truckerId || !message) {
      return res.status(400).json({ message: 'Trucker ID and message are required' });
    }

    if (req.user.role !== 'customer') {
      return res.status(403).json({ message: 'Only customers can send messages to truckers' });
    }

    const User = require('../models/User');
    const trucker = await User.findById(truckerId);
    
    if (!trucker) {
      return res.status(404).json({ message: 'Trucker not found' });
    }

    if (trucker.role !== 'trucker') {
      return res.status(400).json({ message: 'Invalid trucker ID' });
    }

    // Create notification for trucker
    const notification = await Notification.create({
      user: truckerId,
      type: 'message',
      title: `Message from ${req.user.name || 'Customer'}`,
      message: message,
      relatedBooking: bookingId || undefined,
      relatedUser: req.user.id
    });

    // Populate notification before sending
    await notification.populate('relatedBooking');
    await notification.populate('relatedUser', 'name email phone');

    res.status(201).json({
      message: 'Message sent successfully',
      notification
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Send notification to user(s)
router.post('/admin/send', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can send notifications' });
    }

    const { userId, userIds, title, message, type, relatedBooking } = req.body;

    if (!title || !message) {
      return res.status(400).json({ message: 'Title and message are required' });
    }

    if (!userId && !userIds) {
      return res.status(400).json({ message: 'User ID or user IDs are required' });
    }

    const User = require('../models/User');
    const targetUserIds = userId ? [userId] : userIds;

    if (!Array.isArray(targetUserIds) || targetUserIds.length === 0) {
      return res.status(400).json({ message: 'Invalid user IDs' });
    }

    // Validate all users exist
    const users = await User.find({ _id: { $in: targetUserIds } });
    if (users.length !== targetUserIds.length) {
      return res.status(400).json({ message: 'One or more users not found' });
    }

    // Create notifications for all target users
    const notifications = await Promise.all(
      targetUserIds.map(userId => 
        Notification.create({
          user: userId,
          type: type || 'system',
          title: title,
          message: message,
          relatedBooking: relatedBooking || undefined,
          relatedUser: req.user.id
        })
      )
    );

    // Populate notifications
    await Promise.all(
      notifications.map(notif => 
        Promise.all([
          notif.populate('relatedBooking'),
          notif.populate('relatedUser', 'name email phone')
        ])
      )
    );

    res.status(201).json({
      message: `Notification sent to ${notifications.length} user(s)`,
      notifications
    });
  } catch (error) {
    console.error('Admin send notification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;



