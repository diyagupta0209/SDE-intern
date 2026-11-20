import mongoose from 'mongoose';

const ACCOUNT_TYPES = ['checking', 'savings', 'credit', 'cash', 'investment'];

const accountSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    type: { type: String, enum: ACCOUNT_TYPES, required: true },
    currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3, default: 'INR' },
    balanceCents: { type: Number, required: true, default: 0 },
    institution: { type: String, trim: true, maxlength: 80, default: '' },
    allowNegative: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

accountSchema.index({ user: 1, createdAt: -1 });
accountSchema.index({ user: 1, isArchived: 1 });

accountSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

export const ACCOUNT_TYPES_LIST = ACCOUNT_TYPES;
export const Account = mongoose.model('Account', accountSchema);
