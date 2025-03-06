import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { getDashboardAnalytics } from '../controllers/analyticsController.js';

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);
router.use(authorize('admin'));

router.get('/dashboard', getDashboardAnalytics);

export default router; 