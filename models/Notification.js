import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    type: {
        type: String,
        enum: [
            'BUDGET_REQUEST', 'BUDGET_APPROVED', 'BUDGET_REJECTED', 
            'REPORT_FLAGGED', 'FORECAST_VERIFIED', 'NEW_CYCLE', 
            'YIELD_FORECAST', 'FIELD_REPORT',
            'HARVEST_DECLARED', 'HARVEST_PICKED_UP', 'ROOM_REQUESTED', 'ROOM_ASSIGNED', 'QC_COMPLETED',
            'EXPORT_READY', 'SHIPMENT_SCHEDULED', 'SHIPMENT_DISPATCHED'
        ],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    refId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false
    },
    refModel: {
        type: String,
        required: false
    },
    link: {
        type: String // e.g. /pm/crop-planning or /fm/crop-planning
    },
    isRead: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

// Index for faster queries on recipient and read status
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
