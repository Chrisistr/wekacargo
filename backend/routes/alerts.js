const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const { auth } = require('../middleware/auth');
router.post('/', auth, async (req, res) => {
  try {
    const { subject, message } = req.body;
    if (!subject || !subject.trim() || !message || !message.trim()) {
      return res.status(400).json({ message: 'Subject and message are required' });
    }
    const alert = await Alert.create({
      user: req.user.id,
      subject: subject.trim(),
      message: message.trim(),
    });
    res.status(201).json(alert);
  } catch (error) {
    console.error('Create alert error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
});
router.get('/my', auth, async (req, res) => {
  try {
    const alerts = await Alert.find({ user: req.user.id })
      .sort({ createdAt: -1 });
    res.json(alerts);
  } catch (error) {
    console.error('Get my alerts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
module.exports = router;
