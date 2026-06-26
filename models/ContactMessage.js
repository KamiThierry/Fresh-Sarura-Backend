import mongoose from 'mongoose';

const contactMessageSchema = new mongoose.Schema({
    name:        { type: String, required: true, trim: true },
    email:       { type: String, required: true, trim: true },
    type:        { type: String, required: true },
    message:     { type: String, required: true },
    status:      { type: String, enum: ['Unread', 'Read', 'Replied'], default: 'Unread' },
    repliedAt:   { type: Date },
    replyNote:   { type: String },
}, { timestamps: true });

export default mongoose.model('ContactMessage', contactMessageSchema);
