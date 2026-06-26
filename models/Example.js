import mongoose from 'mongoose';

// Example schema - Remove or modify based on your needs
const exampleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Index definitions for performance
exampleSchema.index({ name: 1 });
exampleSchema.index({ isActive: 1 });

// Virtual for document URL
exampleSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

// Transform JSON output
exampleSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret._id;
  },
});

/**
 * Example Model
 * @description This is a sample model to demonstrate the structure
 * Replace or extend based on your specific needs
 */
const Example = mongoose.model('Example', exampleSchema);

export default Example;
