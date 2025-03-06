import Emergency from '../models/emergencyModel.js';
import User from '../models/userModel.js';
import { catchAsync, AppError } from '../utils/errorHandlers.js';

// Get dashboard analytics data
export const getDashboardAnalytics = catchAsync(async (req, res, next) => {
  // Get response time data for the last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const emergencies = await Emergency.find({
    createdAt: { $gte: sevenDaysAgo }
  }).populate('responders');

  if (!emergencies) {
    return next(new AppError('No emergencies found', 404));
  }

  // Calculate response times
  const responseTimeData = emergencies.map(emergency => {
    const assignedTime = emergency.assignedAt ? new Date(emergency.assignedAt) : null;
    const respondedTime = emergency.responderActions ? 
      Object.values(emergency.responderActions).find(action => action.action === 'accepted')?.timestamp : null;
    
    if (assignedTime && respondedTime) {
      const responseTime = (new Date(respondedTime) - assignedTime) / (1000 * 60); // in minutes
      return {
        date: assignedTime.toISOString().split('T')[0],
        responseTime
      };
    }
    return null;
  }).filter(Boolean);

  // Calculate average response time per day
  const responseTimeByDay = responseTimeData.reduce((acc, { date, responseTime }) => {
    if (!acc[date]) {
      acc[date] = { total: 0, count: 0 };
    }
    acc[date].total += responseTime;
    acc[date].count += 1;
    return acc;
  }, {});

  const averageResponseTimes = Object.entries(responseTimeByDay).map(([date, data]) => ({
    date,
    averageTime: data.total / data.count
  }));

  // Get emergency types distribution
  const emergencyTypeData = await Emergency.aggregate([
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 }
      }
    }
  ]);

  const emergencyTypes = emergencyTypeData.reduce((acc, { _id, count }) => {
    acc[_id] = count;
    return acc;
  }, {});

  // Get daily emergencies count
  const dailyEmergencies = await Emergency.aggregate([
    {
      $match: {
        createdAt: { $gte: sevenDaysAgo }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);

  // Get responder performance
  const responders = await User.find({ role: 'responder' });
  
  if (!responders) {
    return next(new AppError('No responders found', 404));
  }

  const responderPerformance = await Promise.all(
    responders.map(async (responder) => {
      const totalAssigned = await Emergency.countDocuments({
        responders: responder._id
      });

      const totalAccepted = await Emergency.countDocuments({
        responders: responder._id,
        [`responderActions.${responder._id}.action`]: 'accepted'
      });

      const totalCompleted = await Emergency.countDocuments({
        responders: responder._id,
        [`responderActions.${responder._id}.action`]: 'completed'
      });

      return {
        responderId: responder._id,
        name: responder.name,
        specialization: responder.specialization,
        totalAssigned,
        totalAccepted,
        totalCompleted,
        acceptanceRate: totalAssigned ? (totalAccepted / totalAssigned) * 100 : 0,
        completionRate: totalAccepted ? (totalCompleted / totalAccepted) * 100 : 0
      };
    })
  );

  res.status(200).json({
    success: true,
    data: {
      responseTimeData: averageResponseTimes,
      emergencyTypeData: emergencyTypes,
      dailyEmergencies,
      responderPerformance
    }
  });
}); 