const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Truck = require('../models/Truck');
const Notification = require('../models/Notification');
const { auth } = require('../middleware/auth');
const { geocodeAddress, calculateRoadDistance } = require('../utils/maps');

const appendTruckActivity = async (truckId, action, performedBy, metadata = {}) => {
  try {
    await Truck.findByIdAndUpdate(truckId, {
      $push: {
        activityLog: {
          action,
          performedBy,
          metadata,
          timestamp: new Date()
        }
      }
    });
  } catch (error) {
    console.error('Truck activity log error:', error);
  }
};

// Get user bookings
router.get('/my-bookings', auth, async (req, res) => {
  try {
    const query = req.user.role === 'customer' 
      ? { customer: req.user.id }
      : { trucker: req.user.id };

    const bookings = await Booking.find(query)
      .populate('customer', 'name phone email location profile rating')
      .populate('trucker', 'name phone email location profile rating')
      .populate('truck')
      .sort({ createdAt: -1 });

    // For truckers, add delivery planning suggestions
    if (req.user.role === 'trucker') {
      const pendingBookings = bookings.filter(b => b.status === 'pending' || b.status === 'confirmed');
      if (pendingBookings.length > 1) {
        // Sort by proximity and urgency for delivery planning
        const plannedBookings = await planDeliveries(pendingBookings);
        bookings.forEach(booking => {
          const planned = plannedBookings.find(p => p._id.toString() === booking._id.toString());
          if (planned) {
            booking.suggestedOrder = planned.order;
            booking.estimatedPickupTime = planned.estimatedPickupTime;
          }
        });
      }
    }

    res.json(bookings);
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to plan deliveries for multiple bookings
const planDeliveries = async (bookings) => {
  if (bookings.length <= 1) return bookings;

  // Calculate distances between all origin-destination pairs
  const calculateDistance = async (coords1, coords2) => {
    if (!coords1 || !coords2 || !coords1.lat || !coords1.lng || !coords2.lat || !coords2.lng) {
      return 999999; // Large distance for missing coordinates
    }
    const result = await calculateRoadDistance(coords1, coords2);
    return result.distance;
  };

  // Simple nearest-neighbor algorithm for route planning
  const planned = [];
  const remaining = [...bookings];
  
  // Start with the booking that has the earliest pickup time or is most urgent
  let current = remaining.reduce((earliest, booking) => {
    const earliestTime = earliest.origin?.pickupTime ? new Date(earliest.origin.pickupTime) : new Date(0);
    const bookingTime = booking.origin?.pickupTime ? new Date(booking.origin.pickupTime) : new Date(0);
    return bookingTime < earliestTime ? booking : earliest;
  }, remaining[0]);

  remaining.splice(remaining.indexOf(current), 1);
  planned.push({ ...current.toObject(), order: 1, estimatedPickupTime: current.origin?.pickupTime || new Date() });

  let order = 2;
  while (remaining.length > 0) {
    // Find the nearest booking from current destination
    const currentDest = current.destination?.coordinates || current.origin?.coordinates;
    let nearest = remaining[0];
    let minDistance = await calculateDistance(currentDest, nearest.origin?.coordinates);

    for (const booking of remaining) {
      const distance = await calculateDistance(currentDest, booking.origin?.coordinates);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = booking;
      }
    }

    // Estimate pickup time (current destination to next origin + some buffer)
    const estimatedTime = new Date(planned[planned.length - 1].estimatedPickupTime);
    estimatedTime.setMinutes(estimatedTime.getMinutes() + Math.ceil(minDistance * 2)); // ~2 min per km

    planned.push({ 
      ...nearest.toObject(), 
      order, 
      estimatedPickupTime: nearest.origin?.pickupTime || estimatedTime 
    });
    
    remaining.splice(remaining.indexOf(nearest), 1);
    current = nearest;
    order++;
  }

  return planned;
};

// Get booking by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('customer', 'name phone email location profile rating')
      .populate('trucker', 'name phone email location profile rating')
      .populate('truck');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Get user ID for comparison (handle both _id and id)
    const userId = req.user.id || req.user._id;
    
    // Handle populated vs non-populated customer/trucker
    let customerId, truckerId;
    if (booking.customer && typeof booking.customer === 'object') {
      customerId = booking.customer._id || booking.customer.id;
    } else {
      customerId = booking.customer;
    }
    
    if (booking.trucker && typeof booking.trucker === 'object') {
      truckerId = booking.trucker._id || booking.trucker.id;
    } else {
      truckerId = booking.trucker;
    }

    // Convert to strings for comparison
    const userIdStr = userId?.toString();
    const customerIdStr = customerId?.toString();
    const truckerIdStr = truckerId?.toString();

    console.log('Booking authorization check:', {
      userRole: req.user.role,
      userId: userIdStr,
      customerId: customerIdStr,
      truckerId: truckerIdStr,
      bookingId: booking._id.toString()
    });

    // Authorization check - allow if user is customer, trucker, or admin
    if (req.user.role === 'admin') {
      // Admin can view any booking
    } else if (req.user.role === 'customer') {
      if (customerIdStr !== userIdStr) {
        console.log('Customer authorization failed:', { customerIdStr, userIdStr });
        return res.status(403).json({ message: 'Not authorized to view this booking' });
      }
    } else if (req.user.role === 'trucker') {
      if (truckerIdStr !== userIdStr) {
        console.log('Trucker authorization failed:', { truckerIdStr, userIdStr });
        return res.status(403).json({ message: 'Not authorized to view this booking' });
      }
    } else {
      // Unknown role
      return res.status(403).json({ message: 'Not authorized to view this booking' });
    }

    res.json(booking);
  } catch (error) {
    console.error('Get booking error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create booking
router.post('/', auth, async (req, res) => {
  try {
    console.log('Booking creation request received');
    console.log('User:', req.user ? { id: req.user.id, role: req.user.role } : 'No user');
    
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    if (req.user.role !== 'customer') {
      return res.status(403).json({ message: 'Only customers can create bookings' });
    }

    const { truckId, origin, destination, cargoDetails, specialInstructions, paymentMethod } = req.body;
    
    console.log('Booking data received:', {
      truckId,
      hasOrigin: !!origin,
      hasDestination: !!destination,
      hasCargoDetails: !!cargoDetails
    });

    // Validate required fields
    if (!truckId) {
      return res.status(400).json({ message: 'Truck ID is required' });
    }

    if (!origin || !origin.address) {
      return res.status(400).json({ message: 'Origin address is required' });
    }

    if (!destination || !destination.address) {
      return res.status(400).json({ message: 'Destination address is required' });
    }

    if (!cargoDetails || !cargoDetails.type || !cargoDetails.weight) {
      return res.status(400).json({ message: 'Cargo type and weight are required' });
    }

    // Check truck availability
    const truck = await Truck.findById(truckId);
    if (!truck) {
      return res.status(404).json({ message: 'Truck not found' });
    }

    // Check if truck is truly unavailable (trucker manually disabled it)
    if (!truck.availability || truck.availability.isAvailable === false) {
      // Check if truck has active bookings (might just be on another job)
      const activeBookings = await Booking.find({
        truck: truckId,
        status: { $in: ['pending', 'confirmed', 'in-transit'] }
      });
      
      if (activeBookings.length > 0) {
        // Truck is on another job, but allow booking with warning
        // The warning will be handled in the response
      } else {
        // Truck is truly unavailable (trucker disabled it)
        return res.status(400).json({ 
          message: 'This truck is currently unavailable. Please select another truck.',
          unavailable: true
        });
      }
    }
    
    // Check if truck has active bookings (on another job)
    const activeBookings = await Booking.find({
      truck: truckId,
      status: { $in: ['pending', 'confirmed', 'in-transit'] }
    });
    
    const isOnAnotherJob = activeBookings.length > 0;

    // Validate truck has a trucker assigned
    if (!truck.trucker) {
      return res.status(400).json({ message: 'Truck does not have an assigned trucker' });
    }

    // Validate cargo weight
    if (parseFloat(cargoDetails.weight) > truck.capacity.weight) {
      return res.status(400).json({ 
        message: `Cargo weight (${cargoDetails.weight} tons) exceeds truck capacity (${truck.capacity.weight} tons)` 
      });
    }

    // Geocode addresses if coordinates are missing
    if (!origin.coordinates || !origin.coordinates.lat || !origin.coordinates.lng) {
      const geocoded = await geocodeAddress(origin.address);
      origin.coordinates = { lat: geocoded.lat, lng: geocoded.lng };
      if (geocoded.formattedAddress) {
        origin.address = geocoded.formattedAddress;
      }
    }

    if (!destination.coordinates || !destination.coordinates.lat || !destination.coordinates.lng) {
      const geocoded = await geocodeAddress(destination.address);
      destination.coordinates = { lat: geocoded.lat, lng: geocoded.lng };
      if (geocoded.formattedAddress) {
        destination.address = geocoded.formattedAddress;
      }
    }

    // Calculate road distance using Google Maps Distance Matrix API
    const distanceResult = await calculateRoadDistance(origin.coordinates, destination.coordinates);
    const distance = distanceResult.distance;
    
    // Validate truck rates exist
    if (!truck.rates || !truck.rates.perKm || !truck.rates.minimumCharge) {
      return res.status(400).json({ message: 'Truck rates are not properly configured' });
    }
    
    const estimatedAmount = truck.rates.perKm * distance;
    const finalAmount = estimatedAmount < truck.rates.minimumCharge 
      ? truck.rates.minimumCharge 
      : estimatedAmount;

    const booking = new Booking({
      customer: req.user.id,
      truck: truckId,
      trucker: truck.trucker,
      origin: {
        address: origin.address,
        coordinates: origin.coordinates || { lat: 0, lng: 0 },
        contact: origin.contact,
        pickupTime: origin.pickupTime ? new Date(origin.pickupTime) : undefined
      },
      destination: {
        address: destination.address,
        coordinates: destination.coordinates || { lat: 0, lng: 0 },
        contact: destination.contact,
        dropoffTime: destination.dropoffTime ? new Date(destination.dropoffTime) : undefined
      },
      cargoDetails: {
        type: cargoDetails.type,
        weight: parseFloat(cargoDetails.weight),
        volume: cargoDetails.volume ? parseFloat(cargoDetails.volume) : undefined,
        description: cargoDetails.description
      },
      specialInstructions: specialInstructions,
      pricing: {
        distance,
        rate: truck.rates.perKm,
        estimatedAmount: finalAmount
      },
      payment: {
        method: paymentMethod || 'mpesa',
        status: paymentMethod === 'cash' ? 'pending' : 'pending'
      }
    });

    await booking.save();

    // Don't mark truck as unavailable if it's just on another job
    // Only mark as unavailable if trucker manually set it to unavailable
    // The truck can handle multiple bookings
    await appendTruckActivity(truck._id, 'Booking created', req.user.id, {
      booking: booking._id,
      status: booking.status
    });

    // Create notification for trucker
    try {
      await Notification.create({
        user: truck.trucker,
        type: 'booking_created',
        title: 'New Booking Request',
        message: `You have a new booking request from ${req.user.name || 'a customer'}. Please review and confirm.`,
        relatedBooking: booking._id,
        relatedUser: req.user.id
      });
    } catch (notifError) {
      console.error('Failed to create notification:', notifError);
      // Don't fail the booking creation if notification fails
    }

    // Populate booking data before sending response
    const populatedBooking = await Booking.findById(booking._id)
      .populate('customer', 'name phone email')
      .populate('trucker', 'name phone email')
      .populate('truck');

    // Include warning if truck is on another job
    const response = populatedBooking.toObject();
    if (isOnAnotherJob) {
      response.warning = {
        message: 'This truck is currently on another delivery. If you need immediate delivery, please consider selecting another available truck. Otherwise, your booking will be scheduled after the current delivery is completed.',
        onAnotherJob: true
      };
    }

    res.status(201).json(response);
  } catch (error) {
    console.error('Create booking error:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ 
      message: error.message || 'Server error while creating booking',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Update booking (edit details - only for pending status)
router.patch('/:id', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Only customer can edit, and only if booking is pending
    if (req.user.role !== 'customer' || booking.customer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to edit this booking' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({ 
        message: 'Booking can only be edited when status is pending. Once confirmed by trucker, changes require communication.' 
      });
    }

    const { origin, destination, cargoDetails, specialInstructions } = req.body;

    // Update allowed fields
    if (origin) {
      if (origin.address) booking.origin.address = origin.address;
      if (origin.coordinates) booking.origin.coordinates = origin.coordinates;
      if (origin.contact !== undefined) booking.origin.contact = origin.contact;
      if (origin.pickupTime) booking.origin.pickupTime = new Date(origin.pickupTime);
    }

    if (destination) {
      if (destination.address) booking.destination.address = destination.address;
      if (destination.coordinates) booking.destination.coordinates = destination.coordinates;
      if (destination.contact !== undefined) booking.destination.contact = destination.contact;
      if (destination.dropoffTime) booking.destination.dropoffTime = new Date(destination.dropoffTime);
    }

    if (cargoDetails) {
      if (cargoDetails.type) booking.cargoDetails.type = cargoDetails.type;
      if (cargoDetails.weight) {
        // Re-validate weight against truck capacity
        const truck = await Truck.findById(booking.truck);
        if (truck && parseFloat(cargoDetails.weight) > truck.capacity.weight) {
          return res.status(400).json({ 
            message: `Cargo weight (${cargoDetails.weight} tons) exceeds truck capacity (${truck.capacity.weight} tons)` 
          });
        }
        booking.cargoDetails.weight = parseFloat(cargoDetails.weight);
      }
      if (cargoDetails.volume !== undefined) booking.cargoDetails.volume = cargoDetails.volume ? parseFloat(cargoDetails.volume) : undefined;
      if (cargoDetails.description !== undefined) booking.cargoDetails.description = cargoDetails.description;
      if (cargoDetails.pictures !== undefined) booking.cargoDetails.pictures = cargoDetails.pictures;
    }

    if (specialInstructions !== undefined) {
      booking.specialInstructions = specialInstructions;
    }

    // Recalculate pricing if origin or destination changed
    if (origin?.coordinates || destination?.coordinates) {
      const truck = await Truck.findById(booking.truck);
      if (truck && truck.rates) {
        const calculateDistance = (coords1, coords2) => {
          if (!coords1 || !coords2 || !coords1.lat || !coords1.lng || !coords2.lat || !coords2.lng) {
            return 50; // Default 50km
          }
          const R = 6371;
          const dLat = (coords2.lat - coords1.lat) * Math.PI / 180;
          const dLon = (coords2.lng - coords1.lng) * Math.PI / 180;
          const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(coords1.lat * Math.PI / 180) * Math.cos(coords2.lat * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return R * c;
        };

        const distance = calculateDistance(booking.origin.coordinates, booking.destination.coordinates);
        const estimatedAmount = truck.rates.perKm * distance;
        const finalAmount = estimatedAmount < truck.rates.minimumCharge 
          ? truck.rates.minimumCharge 
          : estimatedAmount;

        booking.pricing.distance = distance;
        booking.pricing.estimatedAmount = finalAmount;
      }
    }

    await booking.save();

    // Notify trucker of booking update
    try {
      await Notification.create({
        user: booking.trucker,
        type: 'booking_updated',
        title: 'Booking Updated',
        message: `The booking has been updated by the customer. Please review the changes.`,
        relatedBooking: booking._id,
        relatedUser: req.user.id
      });
    } catch (notifError) {
      console.error('Failed to create notification:', notifError);
    }

    const populatedBooking = await Booking.findById(booking._id)
      .populate('customer', 'name phone email')
      .populate('trucker', 'name phone email')
      .populate('truck');

    res.json(populatedBooking);
  } catch (error) {
    console.error('Update booking error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update booking status
router.put('/:id', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const { status, cancellationReason } = req.body;

    // Authorization check
    if (req.user.role === 'customer' && booking.customer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (req.user.role === 'trucker' && booking.trucker.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Validate status transitions
    const validTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['in-transit', 'cancelled'],
      'in-transit': ['completed', 'cancelled'],
      completed: [],
      cancelled: []
    };

    if (!validTransitions[booking.status]?.includes(status)) {
      return res.status(400).json({ 
        message: `Cannot change status from ${booking.status} to ${status}` 
      });
    }

    booking.status = status;

    // Handle cancellation
    if (status === 'cancelled') {
      booking.cancellationReason = cancellationReason;
      booking.cancelledBy = req.user.id;
      booking.cancelledAt = new Date();
      
      // Process refund if payment was made
      if (booking.payment && booking.payment.paymentId) {
        try {
          const Payment = require('../models/Payment');
          const payment = await Payment.findById(booking.payment.paymentId);
          
          if (payment) {
            // Only refund if payment is held in escrow (not yet released to trucker)
            if (payment.escrowStatus === 'held' && 
                (payment.status === 'processing' || payment.status === 'completed')) {
              
              // Update payment status to refunded
              payment.status = 'refunded';
              payment.escrowStatus = 'refunded';
              payment.refundedAt = new Date();
              payment.refundReason = `Booking cancelled by ${req.user.role}: ${cancellationReason || 'No reason provided'}`;
              await payment.save();
              
              // Update booking payment status
              booking.payment.status = 'refunded';
              
              // Create notification for customer about refund
              try {
                await Notification.create({
                  user: booking.customer,
                  type: 'system',
                  title: 'Payment Refunded',
                  message: `Your payment of KES ${payment.amount.toLocaleString()} has been refunded due to booking cancellation.`,
                  relatedBooking: booking._id
                });
              } catch (notifError) {
                console.error('Failed to create refund notification for customer:', notifError);
              }
              
              console.log(`✓ Payment refunded for booking ${booking._id}: KES ${payment.amount}`);
            } else if (payment.escrowStatus === 'released') {
              // Payment was already released to trucker - cannot refund automatically
              console.warn(`⚠ Payment already released to trucker for booking ${booking._id}. Manual refund may be required.`);
              
              // Still update payment status to cancelled
              payment.status = 'cancelled';
              await payment.save();
              booking.payment.status = 'refunded'; // Mark as refunded in booking for tracking
              
              // Notify customer that refund requires manual processing
              try {
                await Notification.create({
                  user: booking.customer,
                  type: 'system',
                  title: 'Refund Processing Required',
                  message: `Your booking was cancelled. Since payment was already released, please contact support for refund processing.`,
                  relatedBooking: booking._id
                });
              } catch (notifError) {
                console.error('Failed to create refund notification:', notifError);
              }
            } else {
              // Payment not completed yet, just mark as cancelled
              payment.status = 'cancelled';
              await payment.save();
              booking.payment.status = 'refunded';
            }
          }
        } catch (refundError) {
          console.error('Error processing refund:', refundError);
          // Don't fail cancellation if refund processing fails
          // Log error for manual review
        }
      } else if (booking.payment && booking.payment.status === 'paid') {
        // Payment was made but no payment record exists (edge case)
        booking.payment.status = 'refunded';
      }
      
      // Check if truck has other active bookings before marking as available
      const truck = await Truck.findById(booking.truck);
      if (truck) {
        const otherActiveBookings = await Booking.find({
          truck: booking.truck,
          _id: { $ne: booking._id },
          status: { $in: ['pending', 'confirmed', 'in-transit'] }
        });
        
        // Only mark truck as available if no other active bookings
        // Don't change availability if trucker manually set it to unavailable
        if (otherActiveBookings.length === 0) {
          if (!truck.availability) {
            truck.availability = { isAvailable: true };
          } else {
            truck.availability.isAvailable = true;
          }
          await truck.save();
        }
      }
      
      // Create cancellation notification
      try {
        const cancelledByRole = req.user.role;
        const notifyUser = cancelledByRole === 'trucker' ? booking.customer : booking.trucker;
        
        await Notification.create({
          user: notifyUser,
          type: 'booking_cancelled',
          title: 'Booking Cancelled',
          message: `Booking has been cancelled by ${req.user.name || 'the ' + cancelledByRole}. ${cancellationReason ? `Reason: ${cancellationReason}` : ''}`,
          relatedBooking: booking._id,
          relatedUser: req.user.id
        });
      } catch (notifError) {
        console.error('Failed to create cancellation notification:', notifError);
      }
    }

    // If completed, check for other active bookings before marking truck as available
    if (status === 'completed') {
      const truck = await Truck.findById(booking.truck);
      if (truck) {
        const otherActiveBookings = await Booking.find({
          truck: booking.truck,
          _id: { $ne: booking._id },
          status: { $in: ['pending', 'confirmed', 'in-transit'] }
        });
        
        // Only mark truck as available if no other active bookings
        if (otherActiveBookings.length === 0) {
          if (!truck.availability) {
            truck.availability = { isAvailable: true };
          } else {
            truck.availability.isAvailable = true;
          }
          await truck.save();
        }
      }

      // Auto-release escrow payment when booking is completed
      if (booking.payment && booking.payment.paymentId) {
        try {
          const Payment = require('../models/Payment');
          const payment = await Payment.findById(booking.payment.paymentId);
          if (payment && payment.escrowStatus === 'held' && payment.status === 'completed') {
            payment.escrowStatus = 'released';
            payment.releasedAt = new Date();
            await payment.save();
            
            // Create notification for trucker
            const Notification = require('../models/Notification');
            await Notification.create({
              user: booking.trucker,
              type: 'system',
              title: 'Payment Released',
              message: `Payment of KES ${payment.amount.toLocaleString()} has been released to your account for completed booking.`,
              relatedBooking: booking._id
            });
          }
        } catch (escrowError) {
          console.error('Auto-release escrow error:', escrowError);
          // Don't fail the booking completion if escrow release fails
        }
      }

      // Create notification for customer to review
      try {
        const Notification = require('../models/Notification');
        await Notification.create({
          user: booking.customer,
          type: 'review',
          title: 'Review Your Delivery',
          message: `Your delivery has been completed! Please rate and review your experience with ${booking.trucker?.name || 'the trucker'}.`,
          relatedBooking: booking._id
        });
      } catch (notifError) {
        console.error('Review notification error:', notifError);
        // Don't fail the booking completion if notification fails
      }
    }

    await booking.save();
    await appendTruckActivity(booking.truck, `Booking status updated to ${status}`, req.user.id, {
      booking: booking._id,
      status,
      cancellationReason: cancellationReason || undefined
    });

    res.json(booking);
  } catch (error) {
    console.error('Update booking error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Geocode address endpoint
router.post('/geocode', auth, async (req, res) => {
  try {
    const { address } = req.body;
    if (!address) {
      return res.status(400).json({ message: 'Address is required' });
    }

    const geocoded = await geocodeAddress(address);
    res.json(geocoded);
  } catch (error) {
    console.error('Geocoding error:', error);
    res.status(500).json({ message: 'Failed to geocode address' });
  }
});

module.exports = router;

