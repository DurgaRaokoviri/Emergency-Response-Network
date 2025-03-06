import mongoose from 'mongoose';

const emergencySchema = new mongoose.Schema({
  type: {
    type: String,
    required: [true, 'Please add an emergency type'],
    enum: ['fire', 'medical', 'police', 'disaster', 'other']
  },
  description: {
    type: String,
    required: [true, 'Please add a description']
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: function(v) {
          return v.length === 2;
        },
        message: 'Coordinates must be [longitude, latitude]'
      }
    },
    address: String
  },
  severity: {
    type: String,
    required: [true, 'Please add severity level'],
    enum: ['low', 'medium', 'high', 'critical']
  },
  status: {
    type: String,
    required: [true, 'Please add a status'],
    enum: ['reported', 'assigned', 'in_progress', 'resolved', 'closed', 'declined', 'pending_reassignment'],
    default: 'reported'
  },
  reportedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  responders: [{
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }],
  responderActions: {
    type: Map,
    of: {
      action: {
        type: String,
        enum: ['accepted', 'declined']
      },
      timestamp: Date
    }
  },
  updates: [{
    message: {
      type: String,
      required: true
    },
    updatedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  assignedAt: Date,
  resolvedAt: Date
});

// Create 2dsphere index for location
emergencySchema.index({ location: '2dsphere' });

export default mongoose.model('Emergency', emergencySchema);