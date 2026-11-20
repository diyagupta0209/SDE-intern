import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 60 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 60 },
    kind: { type: String, enum: ['income', 'expense', 'both'], required: true },
    keywords: { type: [String], default: [] },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true },
);

categorySchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

export const Category = mongoose.model('Category', categorySchema);
