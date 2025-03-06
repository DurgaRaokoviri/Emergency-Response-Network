import Emergency from '../models/emergencyModel.js';
import User from '../models/userModel.js';

// @desc    Create new emergency
// @route   POST /api/emergencies
// @access  Private
export const createEmergency = async (req, res, next) => {
  try {
    console.log('Creating new emergency:', req.body);
    req.body.reportedBy = req.user.id;
    req.body.status = 'reported'; // Always start as reported
    
    const emergency = await Emergency.create(req.body);
    console.log('Emergency created:', emergency);
    
    // Get admin users to notify them
    const adminUsers = await User.find({ role: 'admin' });
    
    // Emit socket event for new emergency (this will be received by admin dashboard)
    const io = req.app.get('io');
    io.emit('new_emergency', {
      ...emergency.toObject(),
      reportedBy: await User.findById(req.user.id).select('name email')
    });
    
    // Notify all admin users about new emergency
    adminUsers.forEach(admin => {
      io.emit('admin_emergency_notification', {
        adminId: admin._id,
        emergency: {
          id: emergency._id,
          type: emergency.type,
          location: emergency.location,
          severity: emergency.severity,
          description: emergency.description,
          reportedBy: req.user.id
        }
      });
    });
    
    // Find and notify nearby responders of the new emergency (without assigning them)
    const nearbyResponders = await findNearbyResponders(
      req.body.type,
      req.body.location.coordinates,
      10000 // 10km radius
    );
    
    if (nearbyResponders.length > 0) {
      console.log(`Notifying ${nearbyResponders.length} nearby responders about new emergency`);
      
      // Notify each nearby responder about the new emergency
      nearbyResponders.forEach(responder => {
        io.emit('new_emergency_nearby', {
          responderId: responder._id,
          emergency: {
            id: emergency._id,
            type: emergency.type,
            location: emergency.location,
            severity: emergency.severity,
            description: emergency.description
          }
        });
      });
      
      // Notify admins about available responders
      adminUsers.forEach(admin => {
        io.emit('admin_available_responders', {
          adminId: admin._id,
          emergency: emergency._id,
          availableResponders: nearbyResponders.map(r => ({
            id: r._id,
            name: r.name,
            specialization: r.specialization,
            distance: r.distance
          }))
        });
      });
    } else {
      console.log('No available responders found nearby');
      // Notify admins that no responders were found nearby
      adminUsers.forEach(admin => {
        io.emit('admin_no_responders_nearby', {
          adminId: admin._id,
          emergency: emergency._id,
          type: emergency.type
        });
      });
    }
    
    // Return populated emergency data
    const populatedEmergency = await Emergency.findById(emergency._id)
      .populate('reportedBy', 'name email');
    
    res.status(201).json({
      success: true,
      data: populatedEmergency
    });
  } catch (error) {
    console.error('Error creating emergency:', error);
    next(error);
  }
};

// @desc    Get all emergencies
// @route   GET /api/emergencies
// @access  Private
export const getEmergencies = async (req, res, next) => {
  try {
    let query;
    
    // Copy req.query
    const reqQuery = { ...req.query };
    
    // Fields to exclude
    const removeFields = ['select', 'sort', 'page', 'limit'];
    
    // Loop over removeFields and delete them from reqQuery
    removeFields.forEach(param => delete reqQuery[param]);
    
    // Create query string
    let queryStr = JSON.stringify(reqQuery);
    
    // Create operators ($gt, $gte, etc)
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);
    
    // Finding resource
    query = Emergency.find(JSON.parse(queryStr))
      .populate('reportedBy', 'name email')
      .populate('responders', 'name email phone specialization');
    
    // Select Fields
    if (req.query.select) {
      const fields = req.query.select.split(',').join(' ');
      query = query.select(fields);
    }
    
    // Sort
    if (req.query.sort) {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt');
    }
    
    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Emergency.countDocuments(JSON.parse(queryStr));
    
    query = query.skip(startIndex).limit(limit);
    
    // Executing query
    const emergencies = await query;
    
    // Pagination result
    const pagination = {};
    
    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit
      };
    }
    
    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit
      };
    }
    
    res.status(200).json({
      success: true,
      count: emergencies.length,
      pagination,
      data: emergencies
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single emergency
// @route   GET /api/emergencies/:id
// @access  Private
export const getEmergency = async (req, res, next) => {
  try {
    const emergency = await Emergency.findById(req.params.id)
      .populate('reportedBy', 'name email')
      .populate('responders', 'name email phone specialization')
      .populate('updates.updatedBy', 'name role');
    
    if (!emergency) {
      res.status(404);
      throw new Error('Emergency not found');
    }
    
    res.status(200).json({
      success: true,
      data: emergency
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update emergency
// @route   PUT /api/emergencies/:id
// @access  Private
export const updateEmergency = async (req, res, next) => {
  try {
    let emergency = await Emergency.findById(req.params.id);
    
    if (!emergency) {
      res.status(404);
      throw new Error('Emergency not found');
    }
    
    // Make sure user is admin or the reporter
    if (req.user.role !== 'admin' && 
        emergency.reportedBy.toString() !== req.user.id && 
        !emergency.responders.includes(req.user.id)) {
      res.status(401);
      throw new Error('Not authorized to update this emergency');
    }
    
    emergency = await Emergency.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    
    // Emit socket event for emergency update
    const io = req.app.get('io');
    io.to(req.params.id).emit('emergency_updated', emergency);
    
    res.status(200).json({
      success: true,
      data: emergency
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add update to emergency
// @route   POST /api/emergencies/:id/updates
// @access  Private
export const addEmergencyUpdate = async (req, res, next) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      res.status(400);
      throw new Error('Please add an update message');
    }
    
    const emergency = await Emergency.findById(req.params.id);
    
    if (!emergency) {
      res.status(404);
      throw new Error('Emergency not found');
    }
    
    // Make sure user is admin, reporter or assigned responder
    if (req.user.role !== 'admin' && 
        emergency.reportedBy.toString() !== req.user.id && 
        !emergency.responders.includes(req.user.id)) {
      res.status(401);
      throw new Error('Not authorized to update this emergency');
    }
    
    const update = {
      message,
      updatedBy: req.user.id,
      timestamp: Date.now()
    };
    
    emergency.updates.push(update);
    
    await emergency.save();
    
    const populatedEmergency = await Emergency.findById(req.params.id)
      .populate('updates.updatedBy', 'name role');
    
    // Emit socket event for emergency update
    const io = req.app.get('io');
    io.to(req.params.id).emit('emergency_update_added', {
      emergencyId: req.params.id,
      update: populatedEmergency.updates[populatedEmergency.updates.length - 1]
    });
    
    res.status(200).json({
      success: true,
      data: populatedEmergency.updates[populatedEmergency.updates.length - 1]
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign responders to emergency
// @route   PUT /api/emergencies/:id/assign
// @access  Private (Admin only)
export const assignResponders = async (req, res, next) => {
  try {
    const { responderIds } = req.body;
    
    if (!responderIds || !Array.isArray(responderIds)) {
      res.status(400);
      throw new Error('Please provide responder IDs');
    }
    
    const emergency = await Emergency.findById(req.params.id);
    
    if (!emergency) {
      res.status(404);
      throw new Error('Emergency not found');
    }
    
    // Only allow assignment if emergency is in 'reported' or 'pending_reassignment' status
    if (!['reported', 'pending_reassignment'].includes(emergency.status)) {
      res.status(400);
      throw new Error('Emergency must be in reported or pending reassignment status to assign responders');
    }
    
    // Verify all responders exist and are available
    const responders = await User.find({
      _id: { $in: responderIds },
      role: 'responder',
      isAvailable: true
    });
    
    if (responders.length === 0) {
      res.status(400);
      throw new Error('No available responders found');
    }
    
    if (responders.length !== responderIds.length) {
      res.status(400);
      throw new Error('One or more responders are not available or do not exist');
    }
    
    // Update emergency with responders
    emergency.responders = responderIds;
    emergency.status = 'assigned';
    emergency.assignedAt = Date.now();
    
    // Clear any previous responder actions
    emergency.responderActions = {};
    
    await emergency.save();
    
    // Get populated emergency data
    const populatedEmergency = await Emergency.findById(emergency._id)
      .populate('reportedBy', 'name email')
      .populate('responders', 'name email phone specialization');
    
    // Emit socket event for responder assignment
    const io = req.app.get('io');
    
    // Notify each responder individually
    responders.forEach(responder => {
      console.log(`Notifying responder ${responder._id} about assignment`);
      io.emit('responder_assigned', {
        responderId: responder._id,
        emergency: {
          id: emergency._id,
          type: emergency.type,
          location: emergency.location,
          severity: emergency.severity,
          description: emergency.description,
          reportedBy: populatedEmergency.reportedBy
        }
      });
    });
    
    // Notify admins about the assignment
    const adminUsers = await User.find({ role: 'admin' });
    adminUsers.forEach(admin => {
      io.emit('admin_responders_assigned', {
        adminId: admin._id,
        emergency: emergency._id,
        responders: responders.map(r => ({
          id: r._id,
          name: r.name,
          specialization: r.specialization
        }))
      });
    });
    
    // Emit general emergency update
    io.emit('emergency_updated', {
      emergencyId: emergency._id,
      status: 'assigned',
      responders: responderIds
    });
    
    res.status(200).json({
      success: true,
      data: populatedEmergency
    });
  } catch (error) {
    console.error('Error assigning responders:', error);
    next(error);
  }
};

// @desc    Update emergency status
// @route   PUT /api/emergencies/:id/status
// @access  Private (Admin and Responders)
export const updateEmergencyStatus = async (req, res, next) => {
  try {
    const { status, responderAction } = req.body;
    
    if (!status) {
      res.status(400);
      throw new Error('Please provide a status');
    }
    
    const emergency = await Emergency.findById(req.params.id);
    
    if (!emergency) {
      res.status(404);
      throw new Error('Emergency not found');
    }
    
    // Make sure user is admin or assigned responder
    if (req.user.role !== 'admin' && !emergency.responders.includes(req.user.id)) {
      res.status(401);
      throw new Error('Not authorized to update this emergency status');
    }
    
    // Get admin users for notifications
    const adminUsers = await User.find({ role: 'admin' });
    const io = req.app.get('io');
    
    // If this is a responder action (accept/decline)
    if (responderAction && req.user.role === 'responder') {
      // Find the responder in the emergency's responders array
      const responderIndex = emergency.responders.findIndex(
        r => r.toString() === req.user.id
      );
      
      if (responderIndex === -1) {
        res.status(400);
        throw new Error('You are not assigned to this emergency');
      }
      
      // Update the responder's response
      if (!emergency.responderActions) {
        emergency.responderActions = {};
      }
      
      emergency.responderActions[req.user.id] = {
        action: responderAction,
        timestamp: Date.now()
      };
      
      // Get responder details for notification
      const responder = await User.findById(req.user.id).select('name specialization');
      
      // Notify admins about the responder's action
      adminUsers.forEach(admin => {
        io.emit('admin_responder_action', {
          adminId: admin._id,
          emergency: emergency._id,
          responder: {
            id: req.user.id,
            name: responder.name,
            specialization: responder.specialization,
            action: responderAction
          }
        });
      });
      
      // If all responders have declined, update emergency status to 'pending_reassignment'
      const allResponders = Object.values(emergency.responderActions);
      const allDeclined = allResponders.length === emergency.responders.length &&
        allResponders.every(r => r.action === 'declined');
      
      if (allDeclined) {
        emergency.status = 'pending_reassignment';
        // Notify admins that all responders declined
        adminUsers.forEach(admin => {
          io.emit('admin_all_declined', {
            adminId: admin._id,
            emergency: emergency._id
          });
        });
      }
    }
    
    emergency.status = status;
    
    if (status === 'resolved') {
      emergency.resolvedAt = Date.now();
      // Notify admins about resolution
      adminUsers.forEach(admin => {
        io.emit('admin_emergency_resolved', {
          adminId: admin._id,
          emergency: emergency._id,
          resolvedBy: req.user.id
        });
      });
    }
    
    await emergency.save();
    
    // Populate responder details before sending response
    const populatedEmergency = await Emergency.findById(req.params.id)
      .populate('reportedBy', 'name email')
      .populate('responders', 'name email phone specialization');
    
    // Emit socket event for status update
    io.to(req.params.id).emit('emergency_status_updated', {
      emergencyId: req.params.id,
      status,
      responderActions: emergency.responderActions
    });
    
    res.status(200).json({
      success: true,
      data: populatedEmergency
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to find nearby responders
const findNearbyResponders = async (emergencyType, coordinates, maxDistance) => {
  console.log(`Finding nearby responders for ${emergencyType} emergency at coordinates:`, coordinates);
  
  let query = {
    role: 'responder',
    isAvailable: true,
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates
        },
        $maxDistance: maxDistance
      }
    }
  };
  
  // If emergency type matches a specialization, prioritize those responders
  if (['fire', 'medical', 'police', 'disaster'].includes(emergencyType)) {
    query.specialization = emergencyType;
    console.log(`Looking for ${emergencyType} specialists within ${maxDistance}m`);
  }
  
  const responders = await User.find(query).limit(5);
  console.log(`Found ${responders.length} specialized responders:`, responders.map(r => ({ id: r._id, name: r.name, specialization: r.specialization })));
  
  // If not enough specialized responders, get any available responders
  if (responders.length < 3 && ['fire', 'medical', 'police', 'disaster'].includes(emergencyType)) {
    console.log(`Not enough ${emergencyType} specialists, looking for additional responders`);
    delete query.specialization;
    const additionalResponders = await User.find(query)
      .limit(5 - responders.length);
    
    console.log(`Found ${additionalResponders.length} additional responders:`, additionalResponders.map(r => ({ id: r._id, name: r.name, specialization: r.specialization })));
    return [...responders, ...additionalResponders];
  }
  
  return responders;
};