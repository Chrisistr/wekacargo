const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Truck = require('../models/Truck');
const Notification = require('../models/Notification');
const { auth } = require('../middleware/auth');
const { geocodeAddress, getAddressSuggestions, calculateRoadDistance } = require('../utils/maps');
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
    if (req.user.role === 'trucker') {
      const pendingBookings = bookings.filter(b => b.status === 'pending' || b.status === 'confirmed');
      if (pendingBookings.length > 1) {
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
const planDeliveries = async (bookings) => {
  if (bookings.length <= 1) return bookings;
  const calculateDistance = async (coords1, coords2) => {
    if (!coords1 || !coords2 || !coords1.lat || !coords1.lng || !coords2.lat || !coords2.lng) {
      return 999999; 
    }
    const result = await calculateRoadDistance(coords1, coords2);
    return result.distance;
  };
  const planned = [];
  const remaining = [...bookings];
  let current = remaining.reduce((earliest, booking) => {
    const earliestTime = earliest.origin?.pickupTime ? new Date(earliest.origin.pickupTime) : new Date(0);
    const bookingTime = booking.origin?.pickupTime ? new Date(booking.origin.pickupTime) : new Date(0);
    return bookingTime < earliestTime ? booking : earliest;
  }, remaining[0]);
  remaining.splice(remaining.indexOf(current), 1);
  planned.push({ ...current.toObject(), order: 1, estimatedPickupTime: current.origin?.pickupTime || new Date() });
  let order = 2;
  while (remaining.length > 0) {
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
    const estimatedTime = new Date(planned[planned.length - 1].estimatedPickupTime);
    estimatedTime.setMinutes(estimatedTime.getMinutes() + Math.ceil(minDistance * 2)); 
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
router.get('/:id', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('customer', 'name phone email location profile rating')
      .populate('trucker', 'name phone email location profile rating')
      .populate('truck');
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    const userId = req.user.id || req.user._id;
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
    if (req.user.role === 'admin') {
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
    const truck = await Truck.findById(truckId);
    if (!truck) {
      return res.status(404).json({ message: 'Truck not found' });
    }
    if (!truck.availability || truck.availability.isAvailable === false) {
      const activeBookings = await Booking.find({
        truck: truckId,
        status: { $in: ['pending', 'confirmed', 'in-transit'] }
      });
      if (activeBookings.length > 0) {
      } else {
        return res.status(400).json({ 
          message: 'This truck is currently unavailable. Please select another truck.',
          unavailable: true
        });
      }
    }
    const activeBookings = await Booking.find({
      truck: truckId,
      status: { $in: ['pending', 'confirmed', 'in-transit'] }
    });
    const isOnAnotherJob = activeBookings.length > 0;
    if (!truck.trucker) {
      return res.status(400).json({ message: 'Truck does not have an assigned trucker' });
    }
    if (parseFloat(cargoDetails.weight) > truck.capacity.weight) {
      return res.status(400).json({ 
        message: `Cargo weight (${cargoDetails.weight} tons) exceeds truck capacity (${truck.capacity.weight} tons)` 
      });
    }
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
    const distanceResult = await calculateRoadDistance(origin.coordinates, destination.coordinates);
    const distance = distanceResult.distance;
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
    await appendTruckActivity(truck._id, 'Booking created', req.user.id, {
      booking: booking._id,
      status: booking.status
    });
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
    }
    const populatedBooking = await Booking.findById(booking._id)
      .populate('customer', 'name phone email')
      .populate('trucker', 'name phone email')
      .populate('truck');
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
router.patch('/:id', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    if (req.user.role !== 'customer' || booking.customer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to edit this booking' });
    }
    if (booking.status !== 'pending') {
      return res.status(400).json({ 
        message: 'Booking can only be edited when status is pending. Once confirmed by trucker, changes require communication.' 
      });
    }
    const { origin, destination, cargoDetails, specialInstructions } = req.body;
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
    if (origin?.coordinates || destination?.coordinates) {
      const truck = await Truck.findById(booking.truck);
      if (truck && truck.rates) {
        const calculateDistance = (coords1, coords2) => {
          if (!coords1 || !coords2 || !coords1.lat || !coords1.lng || !coords2.lat || !coords2.lng) {
            return 50; 
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
router.put('/:id', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    const { status, cancellationReason } = req.body;
    if (req.user.role === 'customer' && booking.customer.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    if (req.user.role === 'trucker' && booking.trucker.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
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
    if (status === 'cancelled') {
      booking.cancellationReason = cancellationReason;
      booking.cancelledBy = req.user.id;
      booking.cancelledAt = new Date();
      if (booking.payment && booking.payment.paymentId) {
        try {
          const Payment = require('../models/Payment');
          const payment = await Payment.findById(booking.payment.paymentId);
          if (payment) {
            if (payment.escrowStatus === 'held' && 
                (payment.status === 'processing' || payment.status === 'completed')) {
              payment.status = 'refunded';
              payment.escrowStatus = 'refunded';
              payment.refundedAt = new Date();
              payment.refundReason = `Booking cancelled by ${req.user.role}: ${cancellationReason || 'No reason provided'}`;
              await payment.save();
              booking.payment.status = 'refunded';
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
              console.warn(`⚠ Payment already released to trucker for booking ${booking._id}. Manual refund may be required.`);
              payment.status = 'cancelled';
              await payment.save();
              booking.payment.status = 'refunded'; 
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
              payment.status = 'cancelled';
              await payment.save();
              booking.payment.status = 'refunded';
            }
          }
        } catch (refundError) {
          console.error('Error processing refund:', refundError);
        }
      } else if (booking.payment && booking.payment.status === 'paid') {
        booking.payment.status = 'refunded';
      }
      const truck = await Truck.findById(booking.truck);
      if (truck) {
        const otherActiveBookings = await Booking.find({
          truck: booking.truck,
          _id: { $ne: booking._id },
          status: { $in: ['pending', 'confirmed', 'in-transit'] }
        });
        if (otherActiveBookings.length === 0) {
          if (!truck.availability) {
            truck.availability = { isAvailable: true };
          } else {
            truck.availability.isAvailable = true;
          }
          await truck.save();
        }
      }
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
    if (status === 'completed') {
      const truck = await Truck.findById(booking.truck);
      if (truck) {
        const otherActiveBookings = await Booking.find({
          truck: booking.truck,
          _id: { $ne: booking._id },
          status: { $in: ['pending', 'confirmed', 'in-transit'] }
        });
        if (otherActiveBookings.length === 0) {
          if (!truck.availability) {
            truck.availability = { isAvailable: true };
          } else {
            truck.availability.isAvailable = true;
          }
          await truck.save();
        }
      }
      if (booking.payment && booking.payment.paymentId) {
        try {
          const Payment = require('../models/Payment');
          const payment = await Payment.findById(booking.payment.paymentId);
          if (payment && payment.escrowStatus === 'held' && payment.status === 'completed') {
            payment.escrowStatus = 'released';
            payment.releasedAt = new Date();
            await payment.save();
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
        }
      }
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
router.post('/geocode/suggestions', auth, async (req, res) => {
  try {
    const { query, limit } = req.body;
    if (!query || query.length < 2) {
      return res.json([]);
    }
    const suggestions = await getAddressSuggestions(query, limit || 5);
    res.json(suggestions);
  } catch (error) {
    console.error('Address suggestions error:', error);
    res.status(500).json({ message: 'Failed to get address suggestions' });
  }
});
router.post('/:id/tracking', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    if (req.user.role !== 'trucker' || booking.trucker.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized. Only the assigned trucker can update tracking.' });
    }
    if (booking.status !== 'in-transit') {
      return res.status(400).json({ 
        message: 'Tracking can only be updated when booking is in-transit',
        currentStatus: booking.status
      });
    }
    const { lat, lng, estimatedArrival } = req.body;
    if (!lat || !lng) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }
    if (lat < -4.7 || lat > 5.5 || lng < 33.9 || lng > 41.9) {
      return res.status(400).json({ 
        message: 'Invalid coordinates. Please ensure you are within Kenya.',
        received: { lat, lng }
      });
    }
    if (!booking.tracking) {
      booking.tracking = {};
    }
    booking.tracking.currentLocation = { lat, lng };
    booking.tracking.lastUpdate = new Date();
    if (estimatedArrival) {
      booking.tracking.estimatedArrival = new Date(estimatedArrival);
    }
    await booking.save();
    try {
      const Notification = require('../models/Notification');
      await Notification.create({
        user: booking.customer,
        type: 'system',
        title: 'Location Updated',
        message: `Your delivery location has been updated. Current location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        relatedBooking: booking._id
      });
    } catch (notifError) {
      console.error('Failed to create tracking notification:', notifError);
    }
    res.json({
      message: 'Tracking location updated successfully',
      tracking: booking.tracking
    });
  } catch (error) {
    console.error('Tracking update error:', error);
    res.status(500).json({ message: 'Failed to update tracking location' });
  }
});
module.exports = router;
