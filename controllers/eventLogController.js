import EventLog from '../models/EventLog.js';
import logger from '../utils/logger.js';

// @desc    Get all event logs
// @route   GET /api/v1/event-logs
// @access  Private (Admin)
export const getAllLogs = async (req, res) => {
    try {
        const { module, action, actor, search } = req.query;
        let query = {};

        if (module && module !== 'All') {
            // Safely handle '&' encoding differences in URL parameters
            const decodedModule = decodeURIComponent(module).replace(/\+/g, ' ');
            query.module = { $regex: `^${decodedModule.replace(/&/g, '.*')}$`, $options: 'i' };
        }
        if (action && action !== 'All') query.action = action;
        if (actor && actor !== 'All') query.actor = actor;

        if (search) {
            query.$or = [
                { description: { $regex: search, $options: 'i' } },
                { actor: { $regex: search, $options: 'i' } },
                { action: { $regex: search, $options: 'i' } }
            ];
        }

        // Date Range Filtering
        const { startDate, endDate } = req.query;
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(new Date(startDate).setUTCHours(0, 0, 0, 0));
            if (endDate) {
                const end = new Date(`${endDate}T23:59:59.999Z`);
                query.createdAt.$lte = end;
            }
        }

        const logs = await EventLog.find(query).sort({ createdAt: -1 });

        res.status(200).json({
            status: 'success',
            results: logs.length,
            data: logs
        });
    } catch (error) {
        logger.error('Get all logs error:', error.message);
        res.status(500).json({
            status: 'error',
            message: 'Server error fetching event logs'
        });
    }
};

// Helper function to create a log (can be imported by other controllers)
export const createEventLog = async (data) => {
    try {
        await EventLog.create(data);
    } catch (error) {
        logger.error('Create event log error:', error.message);
    }
};
