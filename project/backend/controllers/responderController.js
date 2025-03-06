import User from '../models/userModel.js';
import Emergency from '../models/emergencyModel.js';

// @desc    Get all responders
// @route   GET /api/responders
// @access  Private (Admin only)
export const getResponders = async (req, res, next) => {
  try {
    const responders = await User.find({ role: 'responder' });
    
    res.status(200).json({
      success: true,
      count: responders.length,
      data: responders
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get available responders
// @route   GET /api/responders/available
// @access  Private (Admin only)
export const getAvailableResponders = async (req, res, next) => {
  try {
    const responders = await User.find({ 
      role: 'responder',
      isAvailable: true
    });
    
    res.status(200).json({
      success: true,
      count: responders.length,
      data: responders
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get responders by specialization
// @route   GET /api/responders/specialization/:type
// @access  Private (Admin only)
export const getRespondersBySpecialization = async (req, res, next) => {
  try {
    const { type } = req.params;
    
    if (!['fire', 'medical', 'police', 'disaster'].includes(type)) {
      res.status(400);
      throw new Error('Invalid specialization type');
    }
    
    const responders = await User.find({ 
      role: 'responder',
      specialization: type
    });
    
    res.status(200).json({
      success: true,
      count: responders.length,
      data: responders
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get nearby responders
// @route   GET /api/responders/nearby
// @access  Private
export const getNearbyResponders = async (req, res, next) => {
  try {
    const { longitude, latitude, distance = 10000, specialization } = req.query;
    
    if (!longitude || !latitude) {
      res.status(400);
      throw new Error('Please provide longitude and latitude');
    }
    
    const query = {
      role: 'responder',
      isAvailable: true,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseInt(distance)
        }
      }
    };
    
    if (specialization && ['fire', 'medical', 'police', 'disaster'].includes(specialization)) {
      query.specialization = specialization;
    }
    
    const responders = await User.find(query);
    
    res.status(200).json({
      success: true,
      count: responders.length,
      data: responders
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update responder availability
// @route   PUT /api/responders/availability
// @access  Private (Responders only)
export const updateAvailability = async (req, res, next) => {
  try {
    const { isAvailable } = req.body;
    
    if (isAvailable === undefined) {
      res.status(400);
      throw new Error('Please provide availability status');
    }
    
    const responder = await User.findByIdAndUpdate(
      req.user.id,
      { isAvailable },
      { new: true }
    );
    
    // Emit socket event for responder availability update
    const io = req.app.get('io');
    io.emit('responder_availability_updated', {
      responderId: req.user.id,
      isAvailable
    });
    
    res.status(200).json({
      success: true,
      data: responder
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get responder's assigned emergencies
// @route   GET /api/responders/emergencies
// @access  Private (Responders only)
export const getResponderEmergencies = async (req, res, next) => {
  try {
    // Get emergencies where responder is assigned or matches their specialization
    const emergencies = await Emergency.find({
      $or: [
        // Emergencies where responder is already assigned
        { responders: req.user.id },
        // Emergencies that match responder's specialization and are in 'assigned' status
        { 
          type: req.user.specialization,
          status: 'assigned',
          responders: { $ne: req.user.id } // Not already assigned to this responder
        }
      ],
      status: { $nin: ['closed', 'resolved'] } // Exclude closed and resolved emergencies
    })
    .populate('reportedBy', 'name email')
    .populate('responders', 'name email phone specialization')
    .sort('-createdAt');
    
    console.log(`Found ${emergencies.length} emergencies for responder ${req.user.id}`);
    
    res.status(200).json({
      success: true,
      count: emergencies.length,
      data: emergencies
    });
  } catch (error) {
    console.error('Error fetching responder emergencies:', error);
    next(error);
  }
};

// @desc    Update responder location
// @route   PUT /api/responders/location
// @access  Private (Responders only)
export const updateLocation = async (req, res, next) => {
  try {
    const { longitude, latitude } = req.body;
    
    if (!longitude || !latitude) {
      res.status(400);
      throw new Error('Please provide longitude and latitude');
    }
    
    const responder = await User.findByIdAndUpdate(
      req.user.id,
      {
        location: {
          type: 'Point',
          coordinates: [parseFloat(longitude), parseFloat(latitude)]
        }
      },
      { new: true }
    );
    
    // If responder is assigned to any active emergencies, emit location update
    const activeEmergencies = await Emergency.find({
      responders: req.user.id,
      status: { $in: ['assigned', 'in_progress'] }
    });
    
    if (activeEmergencies.length > 0) {
      const io = req.app.get('io');
      activeEmergencies.forEach(emergency => {
        io.to(emergency._id.toString()).emit('responder_location_updated', {
          emergencyId: emergency._id,
          responderId: req.user.id,
          location: responder.location
        });
      });
    }
    
    res.status(200).json({
      success: true,
      data: responder
    });
  } catch (error) {
    next(error);
  }
};