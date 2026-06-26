import Notification from '../models/Notification.js';
import User from '../models/User.js';

// GET /api/v1/notifications
export const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ recipient: req.user._id })
            .sort({ createdAt: -1 })
            .limit(50);
        
        res.status(200).json({ status: 'success', data: notifications });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// PATCH /api/v1/notifications/:id/read
export const markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, recipient: req.user._id },
            { isRead: true },
            { new: true }
        );
        if (!notification) return res.status(404).json({ status: 'error', message: 'Notification not found.' });
        
        res.status(200).json({ status: 'success', data: notification });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// PATCH /api/v1/notifications/read-all
export const markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { recipient: req.user._id, isRead: false },
            { isRead: true }
        );
        res.status(200).json({ status: 'success', message: 'All notifications marked as read.' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// DELETE /api/v1/notifications
export const clearAllNotifications = async (req, res) => {
    try {
        await Notification.deleteMany({ recipient: req.user._id });
        res.status(200).json({ status: 'success', message: 'All notifications cleared.' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// Helper function to create notifications (not an API)
export const createNotification = async ({ recipient, sender, type, title, message, link }) => {
    try {
        const notification = new Notification({
            recipient,
            sender,
            type,
            title,
            message,
            link
        });
        await notification.save();
        return notification;
    } catch (err) {
        console.error('Failed to create notification:', err);
    }
};
// Helper function to notify all users of a specific role
export const notifyByRole = async (role, notificationData) => {
    try {
        const users = await User.find({ role, isActive: true });
        const notifications = users.map(user => ({
            ...notificationData,
            recipient: user._id,
        }));
        
        if (notifications.length > 0) {
            await Notification.insertMany(notifications);
        }
        
        return notifications;
    } catch (err) {
        console.error(`Failed to notify role ${role}:`, err);
    }
};
