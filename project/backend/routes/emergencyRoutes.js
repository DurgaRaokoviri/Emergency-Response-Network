import express from 'express';
import { 
  createEmergency,
  getEmergencies,
  getEmergency,
  updateEmergency,
  addEmergencyUpdate,
  assignResponders,
  updateEmergencyStatus
} from '../controllers/emergencyController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, getEmergencies)
  .post(protect, createEmergency);

router.route('/:id')
  .get(protect, getEmergency)
  .put(protect, updateEmergency);

router.route('/:id/updates')
  .post(protect, addEmergencyUpdate);

router.route('/:id/assign')
  .put(protect, authorize('admin'), assignResponders);

router.route('/:id/status')
  .put(protect, updateEmergencyStatus);

export default router;