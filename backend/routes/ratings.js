const express = require('express');
const router = express.Router();
const Rating = require('../models/Rating');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Truck = require('../models/Truck');
const { auth } = require('../middleware/auth');

// Get ratings for user
router.get('/user/:userId', async (req, res) => {
  try {
    const ratings = await Rating.find({ ratedUser: req.params.userId })
      .populate('ratedBy', 'name')
      .populate('booking')
      .sort({ createdAt: -1 });

    res.json(ratings);
  } catch (error) {
    console.error('Get ratings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Submit rating
router.post('/', auth, async (req, res) => {
  try {
    const { bookingId, rating, review, categories } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.status !== 'completed') {
      return res.status(400).json({ message: 'Booking must be completed first' });
    }

    // Determine role (who is giving the rating)
    let ratedUserId, role;
    if (req.user.id === booking.customer.toString()) {
      ratedUserId = booking.trucker;
      role = 'trucker';
    } else if (req.user.id === booking.trucker.toString()) {
      ratedUserId = booking.customer;
      role = 'customer';
    } else {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Check if rating already exists
    const existingRating = await Rating.findOne({
      booking: bookingId,
      ratedBy: req.user.id
    });

    if (existingRating) {
      return res.status(400).json({ message: 'You have already rated this booking' });
    }

    const newRating = new Rating({
      booking: bookingId,
      ratedUser: ratedUserId,
      ratedBy: req.user.id,
      role,
      truck: booking.truck,
      rating,
      review,
      categories
    });

    await newRating.save();

    // Update user rating
    const ratedUser = await User.findById(ratedUserId);
    if (ratedUser) {
      await ratedUser.updateRating(rating);
    }

    // If it's a trucker rating, update truck rating
    if (role === 'trucker' && booking.truck) {
      const truck = await Truck.findById(booking.truck);
      if (truck) {
        truck.rating.count += 1;
        truck.rating.average = (truck.rating.average * (truck.rating.count - 1) + rating) / truck.rating.count;
        await truck.save();
      }
    }

    // Mark booking review as submitted
    booking.review.submitted = true;
    booking.review.rating = rating;
    booking.review.comment = review;
    await booking.save();

    res.status(201).json(newRating);
  } catch (error) {
    console.error('Create rating error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all ratings (admin only)
router.get('/all', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { status, search } = req.query;
    let query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { review: { $regex: search, $options: 'i' } }
      ];
    }

    const ratings = await Rating.find(query)
      .populate('ratedUser', 'name email role')
      .populate('ratedBy', 'name email')
      .populate('booking', 'origin destination cargoDetails')
      .populate('truck', 'type registrationNumber')
      .sort({ createdAt: -1 });

    res.json(ratings);
  } catch (error) {
    console.error('Get all ratings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete/Moderate rating (admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const rating = await Rating.findById(req.params.id);
    if (!rating) {
      return res.status(404).json({ message: 'Rating not found' });
    }

    // Update status to deleted instead of actually deleting
    rating.status = 'deleted';
    await rating.save();

    // Recalculate user rating
    const ratedUser = await User.findById(rating.ratedUser);
    if (ratedUser) {
      const remainingRatings = await Rating.find({
        ratedUser: rating.ratedUser,
        status: 'active'
      });
      
      if (remainingRatings.length > 0) {
        const totalRating = remainingRatings.reduce((sum, r) => sum + r.rating, 0);
        ratedUser.rating.average = totalRating / remainingRatings.length;
        ratedUser.rating.count = remainingRatings.length;
      } else {
        ratedUser.rating.average = 0;
        ratedUser.rating.count = 0;
      }
      await ratedUser.save();
    }

    // Recalculate truck rating if applicable
    if (rating.truck) {
      const truck = await Truck.findById(rating.truck);
      if (truck) {
        const remainingRatings = await Rating.find({
          truck: rating.truck,
          status: 'active'
        });
        
        if (remainingRatings.length > 0) {
          const totalRating = remainingRatings.reduce((sum, r) => sum + r.rating, 0);
          truck.rating.average = totalRating / remainingRatings.length;
          truck.rating.count = remainingRatings.length;
        } else {
          truck.rating.average = 0;
          truck.rating.count = 0;
        }
        await truck.save();
      }
    }

    res.json({ message: 'Rating deleted successfully' });
  } catch (error) {
    console.error('Delete rating error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Check if user has already reviewed a booking
router.get('/booking/:bookingId/check', auth, async (req, res) => {
  try {
    const rating = await Rating.findOne({
      booking: req.params.bookingId,
      ratedBy: req.user.id
    });

    res.json({ hasReviewed: !!rating, rating: rating || null });
  } catch (error) {
    console.error('Check rating error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

