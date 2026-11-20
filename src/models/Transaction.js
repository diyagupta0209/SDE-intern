import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    amountCents: { type: Number, required: true, min: 1 },
    description: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
    merchant: { type: String, trim: true, maxlength: 80, default: '' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    categoryName: { type: String, required: true },
    categorySource: { type: String, enum: ['manual', 'llm', 'rules'], required: true },
    categoryConfidence: { type: Number, min: 0, max: 1, default: 1 },
    categoryReason: { type: String, maxlength: 280, default: '' },
    occurredAt: { type: Date, required: true, default: () => new Date() },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
    tags: { type: [String], default: [] },
  },
  { timestamps: true },
);

transactionSchema.index({ user: 1, occurredAt: -1 });
transactionSchema.index({ account: 1, occurredAt: -1 });
transactionSchema.index({ user: 1, type: 1, occurredAt: -1 });
transactionSchema.index({ user: 1, category: 1, occurredAt: -1 });

transactionSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    return ret;
  },
});

export const Transaction = mongoose.model('Transaction', transactionSchema);
