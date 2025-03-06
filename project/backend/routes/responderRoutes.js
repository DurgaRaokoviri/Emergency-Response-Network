import express from 'express';
import { 
  getResponders,
  getAvailableResponders,
  getRespondersBySpecialization,
  getNearbyResponders,
  updateAvailability,
  getResponderEmergencies,
  updateLocation
} from '../controllers/responderController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, authorize('admin'), getResponders);
router.get('/available', protect, authorize('admin'), getAvailableResponders);
router.get('/specialization/:type', protect, authorize('admin'), getRespondersBySpecialization);
router.get('/nearby', protect, getNearbyResponders);
router.put('/availability', protect, authorize('responder'), updateAvailability);
router.get('/emergencies', protect, authorize('responder'), getResponderEmergencies);
router.put('/location', protect, authorize('responder'), updateLocation);

export default router;