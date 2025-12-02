const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Generate JWT token
const generateToken = (id) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured. Please set it in your .env file.');
  }
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// Register user
router.post('/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['trucker', 'customer']).withMessage('Role must be trucker or customer')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          message: 'Validation failed',
          errors: errors.array() 
        });
      }

      const { name, email, phone, password, role, location } = req.body;

      // Normalize email
      const normalizedEmail = email.trim().toLowerCase();

      // Prevent admin email registration
      if (normalizedEmail === 'admin@admin.com' || normalizedEmail === 'admin') {
        return res.status(400).json({ message: 'This email cannot be used for registration' });
      }

      // Check if user exists
      const existingUser = await User.findOne({ 
        $or: [
          { email: normalizedEmail }, 
          { phone: phone.trim() }
        ] 
      });
      
      if (existingUser) {
        if (existingUser.email === normalizedEmail) {
          return res.status(400).json({ message: 'An account with this email already exists' });
        }
        if (existingUser.phone === phone.trim()) {
          return res.status(400).json({ message: 'An account with this phone number already exists' });
        }
      }

      // Create user (password will be hashed automatically by User model)
      const user = new User({
        name: name.trim(),
        email: normalizedEmail,
        phone: phone.trim(),
        password, // Will be hashed by pre-save hook
        role,
        location
      });

      // Set status to active on registration
      user.status = 'active';
      await user.save();

      const token = generateToken(user._id);

      res.status(201).json({
        token,
        user: {
          id: user._id.toString(),
          _id: user._id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          location: user.location,
          rating: user.rating || { average: 0, count: 0 }
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      
      // Handle duplicate key errors
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return res.status(400).json({ 
          message: `An account with this ${field} already exists` 
        });
      }
      
      res.status(500).json({ message: 'Server error during registration. Please try again.' });
    }
  }
);

// Login user
router.post('/login',
  [
    body('email').trim().notEmpty().withMessage('Email is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          message: 'Validation failed',
          errors: errors.array() 
        });
      }

      const { email, password } = req.body;
      
      // Validate inputs
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Check for admin login attempts
      if (normalizedEmail === 'admin' || normalizedEmail === 'admin@admin.com') {
        return res.status(403).json({ 
          message: 'Please use the admin portal to login at /admin/login' 
        });
      }

      // Validate email format
      if (!normalizedEmail.includes('@') || normalizedEmail.length < 3) {
        return res.status(400).json({ message: 'Please provide a valid email address' });
      }

      // Find user by email (case insensitive)
      const user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      // Prevent admin login through regular route
      if (user.role === 'admin') {
        return res.status(403).json({ 
          message: 'Please use the admin portal to login at /admin/login' 
        });
      }

      // Verify password using bcrypt
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      // Check account status (default to 'active' if status is not set)
      const userStatus = user.status || 'active';
      if (userStatus !== 'active') {
        const statusMessage = userStatus === 'suspended' 
          ? 'Your account has been suspended. Please contact support.' 
          : 'Your account has been banned. Please contact support.';
        return res.status(401).json({ message: statusMessage });
      }

      // Update user status to active on login
      user.status = 'active';
      await user.save();

      // Generate token
      const token = generateToken(user._id);

      res.json({
        token,
        user: {
          id: user._id.toString(),
          _id: user._id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          location: user.location || {},
          rating: user.rating || { average: 0, count: 0 },
          profile: user.profile || {},
          mpesaDetails: user.mpesaDetails || {}
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ 
        message: 'Server error during login. Please try again.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// Admin login
router.post('/admin/login',
  [
    body('email').trim().notEmpty().withMessage('Email or username is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          message: 'Validation failed',
          errors: errors.array() 
        });
      }

      const { email, password } = req.body;
      
      // Validate inputs
      if (!email || !password) {
        return res.status(400).json({ message: 'Email/username and password are required' });
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Find admin user - allow both 'admin' and 'admin@admin.com'
      const user = await User.findOne({ 
        $or: [
          { email: 'admin@admin.com' },
          { email: normalizedEmail }
        ],
        role: 'admin'
      });

      if (!user) {
        return res.status(401).json({ message: 'Invalid admin credentials' });
      }

      // Verify email matches admin credentials (allow 'admin' or 'admin@admin.com')
      if (normalizedEmail !== 'admin' && normalizedEmail !== 'admin@admin.com') {
        return res.status(401).json({ message: 'Invalid admin credentials' });
      }

      // Use bcrypt to compare password (password is hashed in database)
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid admin credentials' });
      }

      // Check account status
      if (user.status !== 'active') {
        const statusMessage = user.status === 'suspended' 
          ? 'Admin account has been suspended' 
          : 'Admin account has been banned';
        return res.status(401).json({ message: statusMessage });
      }

      // Update user status to active on login (admin always stays active)
      user.status = 'active';
      await user.save();

      // Generate token
      const token = generateToken(user._id);

      res.json({
        token,
        user: {
          id: user._id.toString(),
          _id: user._id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          location: user.location || {},
          rating: user.rating || { average: 0, count: 0 },
          profile: user.profile || {},
          mpesaDetails: user.mpesaDetails || {}
        }
      });
    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({ message: 'Server error during admin login. Please try again.' });
    }
  }
);

// Google OAuth login
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    
    if (!credential) {
      return res.status(400).json({ message: 'Google credential is required' });
    }

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;

    // Check if user exists
    let user = await User.findOne({ email });
    let needsRegistration = false;

    if (user) {
      // Update user with Google info if needed
      if (!user.profile) user.profile = {};
      if (!user.profile.avatar) user.profile.avatar = picture;
      await user.save();
    } else {
      // Check if phone is a temporary Google phone (needs registration)
      needsRegistration = true;
      
      // Create temporary user with Google info
      user = new User({
        name,
        email,
        phone: `google_${googleId}`, // Temporary phone - will be updated
        password: require('crypto').randomBytes(16).toString('hex'), // Random password
        role: 'customer', // Default role - can be changed during registration
        profile: {
          avatar: picture,
        },
        verification: {
          emailVerified: true,
        },
      });
      await user.save();
    }

    if (user.status !== 'active') {
      return res.status(401).json({ message: 'Account is suspended or banned' });
    }

    // Update user status to active on login
    user.status = 'active';
    await user.save();

    // Check if user needs to complete registration (has temporary phone)
    if (user.phone && user.phone.startsWith('google_')) {
      needsRegistration = true;
    }

    const token = generateToken(user._id);

    res.json({
      token,
      needsRegistration,
      user: {
        id: user._id.toString(),
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        location: user.location || {},
        rating: user.rating || { average: 0, count: 0 },
        profile: user.profile || {},
      },
    });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({ message: 'Server error during Google login' });
  }
});

// Complete Google registration with additional info
router.post('/google/complete', auth, [
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('role').isIn(['trucker', 'customer']).withMessage('Role must be trucker or customer'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user already completed registration
    if (!user.phone.startsWith('google_')) {
      return res.status(400).json({ message: 'Registration already completed' });
    }

    const { phone, role, location } = req.body;

    // Check if phone is already taken
    const existingUser = await User.findOne({ phone, _id: { $ne: user._id } });
    if (existingUser) {
      return res.status(400).json({ message: 'Phone number already registered' });
    }

    // Update user with complete information
    user.phone = phone;
    user.role = role;
    user.status = 'active'; // Set to active when completing registration
    if (location) {
      user.location = location;
    }

    await user.save();

    res.json({
      message: 'Registration completed successfully',
      user: {
        id: user._id.toString(),
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        location: user.location || {},
        rating: user.rating || { average: 0, count: 0 },
        profile: user.profile || {},
      },
    });
  } catch (error) {
    console.error('Complete Google registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user status to active when they check their profile (they're online)
    if (user.status !== 'active') {
      user.status = 'active';
      await user.save();
    }

    // Return user with consistent ID format
    const userObj = user.toObject();
    res.json({
      ...userObj,
      id: user._id.toString(),
      _id: user._id.toString()
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Logout endpoint - set user status to inactive
router.post('/logout', auth, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId);
    
    if (user && user.role !== 'admin') {
      // Only set to inactive if not admin (admin stays active)
      user.status = 'inactive';
      await user.save();
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

