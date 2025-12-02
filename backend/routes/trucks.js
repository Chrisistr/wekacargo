const express = require('express');
const router = express.Router();
const Truck = require('../models/Truck');
const User = require('../models/User');
const RemovalRequest = require('../models/RemovalRequest');
const { auth } = require('../middleware/auth');

// Helper function to transform geospatial coordinates to frontend format
const transformTruckForResponse = (truck) => {
  const truckObj = truck.toObject ? truck.toObject() : truck;
  if (truckObj.location && truckObj.location.coordinates && truckObj.location.coordinates.coordinates) {
    const [lng, lat] = truckObj.location.coordinates.coordinates;
    truckObj.location.coordinates = { lat, lng };
  }
  return truckObj;
};

const logTruckActivity = async (truckId, action, performedBy, metadata = {}) => {
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

// Get all trucks with filters
router.get('/', async (req, res) => {
  try {
    // Get user role from token if provided (optional auth)
    let userRole = null;
    try {
      const authHeader = req.header('Authorization');
      if (authHeader) {
        const jwt = require('jsonwebtoken');
        const token = authHeader.replace('Bearer ', '').trim();
        if (token && token !== 'null' && token !== 'undefined' && process.env.JWT_SECRET) {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const User = require('../models/User');
          const user = await User.findById(decoded.id).select('role');
          if (user) userRole = user.role;
        }
      }
    } catch (e) {
      // Ignore auth errors for public truck listing
    }

    const { 
      type, 
      minCapacity, 
      maxCapacity, 
      lat, 
      lng, 
      maxDistance,
      minRating,
      isAvailable 
    } = req.query;

    let query = {};

    // Type filter
    if (type) {
      query.type = type;
    }

    // Capacity filter
    if (minCapacity || maxCapacity) {
      query['capacity.weight'] = {};
      if (minCapacity) query['capacity.weight'].$gte = parseFloat(minCapacity);
      if (maxCapacity) query['capacity.weight'].$lte = parseFloat(maxCapacity);
    }

    // Location filter (within distance)
    if (lat && lng && maxDistance) {
      query['location.coordinates'] = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: parseFloat(maxDistance) * 1000 // Convert km to meters
        }
      };
    } else if (lat && lng) {
      // Find nearby trucks without max distance
      query['location.coordinates'] = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          }
        }
      };
    }

    // Rating filter
    if (minRating) {
      query['rating.average'] = { $gte: parseFloat(minRating) };
    }

    // Availability filter
    if (isAvailable !== undefined) {
      query['availability.isAvailable'] = isAvailable === 'true';
    }

    // Status filter
    query.status = 'active';

    const trucks = await Truck.find(query)
      .populate('trucker', 'name phone email rating location profile')
      .limit(50)
      .sort({ 'rating.average': -1, createdAt: -1 });

    const transformedTrucks = trucks.map(truck => {
      const truckObj = transformTruckForResponse(truck);
      // Only include proof of ownership for admins
      if (userRole !== 'admin') {
        delete truckObj.proofOfOwnership;
      }
      return truckObj;
    });
    res.json(transformedTrucks);
  } catch (error) {
    console.error('Get trucks error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get truck by ID
router.get('/:id', async (req, res) => {
  try {
    // Get user role from token if provided (optional auth)
    let userRole = null;
    try {
      const authHeader = req.header('Authorization');
      if (authHeader) {
        const jwt = require('jsonwebtoken');
        const token = authHeader.replace('Bearer ', '').trim();
        if (token && token !== 'null' && token !== 'undefined' && process.env.JWT_SECRET) {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const User = require('../models/User');
          const user = await User.findById(decoded.id).select('role');
          if (user) userRole = user.role;
        }
      }
    } catch (e) {
      // Ignore auth errors for public truck viewing
    }

    const truck = await Truck.findById(req.params.id)
      .populate('trucker', 'name phone email rating location profile verification status');

    if (!truck) {
      return res.status(404).json({ message: 'Truck not found' });
    }

    const transformedTruck = transformTruckForResponse(truck);
    
    // Only include proof of ownership for admins
    if (userRole !== 'admin') {
      delete transformedTruck.proofOfOwnership;
    }

    res.json(transformedTruck);
  } catch (error) {
    console.error('Get truck error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create truck (truckers only)
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'trucker') {
      return res.status(403).json({ message: 'Only truckers can create trucks' });
    }

    const truckData = {
      ...req.body,
      trucker: req.user.id
    };

    // Transform location coordinates to geospatial format [lng, lat]
    if (truckData.location && truckData.location.coordinates) {
      const { lat, lng } = truckData.location.coordinates;
      if (lat !== undefined && lng !== undefined) {
        truckData.location.coordinates = {
          type: 'Point',
          coordinates: [parseFloat(lng), parseFloat(lat)]
        };
      }
    }

    const truck = new Truck(truckData);
    truck.activityLog = [{
      action: 'Truck created',
      performedBy: req.user.id,
      timestamp: new Date(),
      metadata: {}
    }];
    await truck.save();
    await User.findByIdAndUpdate(req.user.id, { $addToSet: { trucks: truck._id } });

    const transformedTruck = transformTruckForResponse(truck);
    res.status(201).json(transformedTruck);
  } catch (error) {
    console.error('Create truck error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update truck (owner only)
router.put('/:id', auth, async (req, res) => {
  try {
    const truck = await Truck.findById(req.params.id);

    if (!truck) {
      return res.status(404).json({ message: 'Truck not found' });
    }

    if (truck.trucker.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Transform location coordinates to geospatial format [lng, lat]
    if (req.body.location && req.body.location.coordinates) {
      const { lat, lng } = req.body.location.coordinates;
      if (lat !== undefined && lng !== undefined) {
        req.body.location.coordinates = {
          type: 'Point',
          coordinates: [parseFloat(lng), parseFloat(lat)]
        };
      }
    }

    Object.assign(truck, req.body);
    await truck.save();
    await logTruckActivity(truck._id, 'Truck updated', req.user.id, req.body);

    const transformedTruck = transformTruckForResponse(truck);
    res.json(transformedTruck);
  } catch (error) {
    console.error('Update truck error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete truck (owner only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const truck = await Truck.findById(req.params.id);

    if (!truck) {
      return res.status(404).json({ message: 'Truck not found' });
    }

    if (truck.trucker.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await User.findByIdAndUpdate(truck.trucker, { $pull: { trucks: truck._id } });
    await logTruckActivity(truck._id, 'Truck deleted', req.user.id);
    await Truck.findByIdAndDelete(truck._id);

    res.json({ message: 'Truck deleted successfully' });
  } catch (error) {
    console.error('Delete truck error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Request truck removal (truckers only, with reason)
router.post('/:id/removal-request', auth, async (req, res) => {
  try {
    if (req.user.role !== 'trucker') {
      return res.status(403).json({ message: 'Only truckers can request removal' });
    }

    const truck = await Truck.findById(req.params.id);

    if (!truck) {
      return res.status(404).json({ message: 'Truck not found' });
    }

    if (truck.trucker.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to manage this truck' });
    }

    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'Reason is required' });
    }

    // Prevent multiple pending requests for the same truck
    const existingPending = await RemovalRequest.findOne({
      truck: truck._id,
      status: 'pending',
    });

    if (existingPending) {
      return res
        .status(400)
        .json({ message: 'There is already a pending removal request for this truck' });
    }

    const request = await RemovalRequest.create({
      truck: truck._id,
      trucker: req.user.id,
      reason: reason.trim(),
    });

    await logTruckActivity(truck._id, 'Removal requested', req.user.id, {
      reason: reason.trim(),
      requestId: request._id,
    });

    res.status(201).json(request);
  } catch (error) {
    console.error('Create removal request error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

