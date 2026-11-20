import mongoose from 'mongoose';
import { ROLES } from '../constants/roles.js';
import { connectDb } from '../config/db.js';
import { getEnv } from '../config/env.js';
import { Account } from '../models/Account.js';
import { Category } from '../models/Category.js';
import { User } from '../models/User.js';
import { ensureDefaultCategories } from '../services/categoryService.js';
import { createTransaction } from '../services/transactionService.js';
import { toCents } from '../utils/money.js';

const env = getEnv();
await connectDb(env.mongodbUri);
await ensureDefaultCategories();
console.log('Default categories are ready');

if (env.seedAdminEmail && env.seedAdminPassword) {
  const email = env.seedAdminEmail.toLowerCase();
  const existing = await User.findOne({ email });
  if (!existing) {
    await User.create({
      name: env.seedAdminName,
      email,
      password: env.seedAdminPassword,
      role: ROLES.ADMIN,
    });
    console.log(`Created admin ${email}`);
  } else {
    console.log(`Admin ${email} already exists`);
  }
}

if (process.argv.includes('--demo')) {
  const email = 'demo@zorvyn.local';
  let demo = await User.findOne({ email });
  if (!demo) {
    demo = await User.create({
      name: 'Demo User',
      email,
      password: 'Demopass1',
      role: ROLES.USER,
    });
  }
  let account = await Account.findOne({ user: demo._id, name: 'Everyday Checking' });
  if (!account) {
    account = await Account.create({
      user: demo._id,
      name: 'Everyday Checking',
      type: 'checking',
      currency: 'INR',
      institution: 'Zorvyn Bank',
      allowNegative: false,
      balanceCents: 0,
    });
  }
  const existingTx = await mongoose.connection.collection('transactions').countDocuments({ user: demo._id });
  if (existingTx === 0) {
    const categories = await Category.find();
    const samples = [
      { type: 'income', amount: '85000.00', description: 'Monthly salary from Zorvyn' },
      { type: 'expense', amount: '240.00', description: 'Coffee at Starbucks', merchant: 'Starbucks' },
      { type: 'expense', amount: '640.50', description: 'Uber ride to the office', merchant: 'Uber' },
      { type: 'expense', amount: '1499.00', description: 'Electricity bill April', merchant: 'State Power' },
    ];
    for (const sample of samples) {
      await createTransaction({
        ownerId: demo.id,
        categories,
        input: {
          accountId: account.id,
          type: sample.type,
          amountCents: toCents(sample.amount),
          description: sample.description,
          merchant: sample.merchant || '',
        },
      });
    }
    console.log('Seeded demo user demo@zorvyn.local / Demopass1');
  } else {
    console.log('Demo transactions already exist');
  }
}

await mongoose.disconnect();
