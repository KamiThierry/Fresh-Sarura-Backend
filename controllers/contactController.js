import ContactMessage from '../models/ContactMessage.js';
import { sendContactReplyEmail } from '../utils/emailService.js';
import { createEventLog } from './eventLogController.js';
import logger from '../utils/logger.js';

// @route POST /api/v1/contact  — public, no auth
export const submitMessage = async (req, res) => {
    try {
        const { name, email, type, message } = req.body;

        if (!name || !email || !type || !message) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        const msg = await ContactMessage.create({ name, email, type, message });

        logger.info(`New contact message from ${email} — type: ${type}`);

        res.status(201).json({
            status: 'success',
            message: 'Your message has been received. We will respond within 24 hours.',
            data: { id: msg._id }
        });
    } catch (err) {
        logger.error('Contact submit error:', err.message);
        res.status(500).json({ message: 'Server error. Please try again.' });
    }
};

// @route GET /api/v1/contact  — admin only
export const getMessages = async (req, res) => {
    try {
        const messages = await ContactMessage.find().sort({ createdAt: -1 });
        res.status(200).json({ status: 'success', results: messages.length, data: messages });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @route PATCH /api/v1/contact/:id/read  — admin only
export const markAsRead = async (req, res) => {
    try {
        const msg = await ContactMessage.findByIdAndUpdate(
            req.params.id,
            { status: 'Read' },
            { new: true }
        );
        if (!msg) return res.status(404).json({ message: 'Message not found.' });
        res.status(200).json({ status: 'success', data: msg });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @route POST /api/v1/contact/:id/reply  — admin only
export const replyToMessage = async (req, res) => {
    try {
        const { replyNote } = req.body;
        if (!replyNote?.trim()) {
            return res.status(400).json({ message: 'Reply message is required.' });
        }

        const msg = await ContactMessage.findById(req.params.id);
        if (!msg) return res.status(404).json({ message: 'Message not found.' });

        await sendContactReplyEmail({
            toName:      msg.name,
            toEmail:     msg.email,
            inquiryType: msg.type,
            originalMsg: msg.message,
            replyNote,
            adminName:   req.user?.name || 'FreshSarura Team',
        });

        msg.status    = 'Replied';
        msg.repliedAt = new Date();
        msg.replyNote = replyNote;
        await msg.save();

        await createEventLog({
            module:      'System',
            action:      'Contact Reply Sent',
            severity:    'INFO',
            description: `Admin replied to inquiry from ${msg.email} (${msg.type})`,
            actor:       req.user?.name || 'Admin',
            metadata:    { messageId: msg._id, senderEmail: msg.email }
        });

        res.status(200).json({ status: 'success', message: 'Reply sent successfully.' });
    } catch (err) {
        logger.error('Reply error:', err.message);
        res.status(500).json({ message: 'Failed to send reply. Check email config.' });
    }
};

// @route DELETE /api/v1/contact/:id — admin only
export const deleteMessage = async (req, res) => {
    try {
        const msg = await ContactMessage.findByIdAndDelete(req.params.id);
        if (!msg) return res.status(404).json({ message: 'Message not found.' });

        await createEventLog({
            module:      'System',
            action:      'Contact Message Deleted',
            severity:    'WARNING',
            description: `Admin deleted contact inquiry from ${msg.email}`,
            actor:       req.user?.name || 'Admin',
            metadata:    { messageId: msg._id, senderEmail: msg.email }
        });

        res.status(200).json({ status: 'success', message: 'Message deleted successfully.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
