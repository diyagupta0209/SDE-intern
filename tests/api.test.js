import './env.js';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { Account } from '../src/models/Account.js';
import { Category } from '../src/models/Category.js';
import { Transaction } from '../src/models/Transaction.js';
import { User } from '../src/models/User.js';
import { ensureDefaultCategories } from '../src/services/categoryService.js';

describe('Zorvyn API', { concurrency: 1 }, () => {
  let mongod;
  let app;

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    await ensureDefaultCategories();
    app = createApp();
  }, { timeout: 180_000 });

  after(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      Account.deleteMany({}),
      Transaction.deleteMany({}),
    ]);
  });

  function bearer(token) {
    return { Authorization: `Bearer ${token}` };
  }

  async function register(overrides = {}) {
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Asha Rao',
      email: `user-${unique}@zorvyn.test`,
      password: 'Secretpass1',
      ...overrides,
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body.data;
  }

  async function login(email, password = 'Secretpass1') {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    return res.body.data;
  }

  async function userWithRole(role) {
    const unique = `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const email = `${unique}@zorvyn.test`;
    await User.create({ name: role, email, password: 'Secretpass1', role });
    return login(email);
  }

  async function openAccount(token, extra = {}) {
    const res = await request(app)
      .post('/api/v1/accounts')
      .set(bearer(token))
      .send({
        name: 'Everyday Checking',
        type: 'checking',
        currency: 'inr',
        institution: 'Zorvyn Bank',
        openingBalance: '1000.00',
        ...extra,
      });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body.data;
  }

  async function addTransaction(token, accountId, extra = {}) {
    const res = await request(app)
      .post('/api/v1/transactions')
      .set(bearer(token))
      .send({
        accountId,
        type: 'expense',
        amount: '240.00',
        description: 'Coffee at Starbucks',
        merchant: 'Starbucks',
        ...extra,
      });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body.data;
  }

  it('reports health and rejects unknown routes', async () => {
    const home = await request(app).get('/');
    assert.equal(home.status, 200);
    assert.match(home.headers['content-type'], /html/);
    assert.match(home.text, /Zorvyn FinTech API/);

    const favicon = await request(app).get('/favicon.ico');
    assert.equal(favicon.status, 204);

    const health = await request(app).get('/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.data.mongo, 'connected');
    assert.ok(health.headers['x-request-id']);

    const missing = await request(app).get('/api/v1/does-not-exist');
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error.code, 'NOT_FOUND');
  });

  it('validates registration and rejects bad JSON', async () => {
    const invalid = await request(app).post('/api/v1/auth/register').send({ email: 'not-an-email' });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error.code, 'VALIDATION_ERROR');
    assert.ok(invalid.body.error.details.length >= 1);

    const malformed = await request(app)
      .post('/api/v1/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"name":');
    assert.equal(malformed.status, 400);
    assert.equal(malformed.body.error.code, 'INVALID_JSON');
  });

  it('registers, logs in, refreshes, and logs out', async () => {
    const created = await register({ email: 'asha@zorvyn.test' });
    assert.equal(created.user.role, 'user');
    assert.equal(created.user.password, undefined);

    const me = await request(app).get('/api/v1/auth/me').set(bearer(created.accessToken));
    assert.equal(me.status, 200);
    assert.equal(me.body.data.email, 'asha@zorvyn.test');

    const duplicate = await request(app).post('/api/v1/auth/register').send({
      name: 'Asha Rao',
      email: 'Asha@zorvyn.test',
      password: 'Secretpass1',
    });
    assert.equal(duplicate.status, 409);

    const refreshed = await request(app).post('/api/v1/auth/refresh').send({
      refreshToken: created.refreshToken,
    });
    assert.equal(refreshed.status, 200);
    const reused = await request(app).post('/api/v1/auth/refresh').send({
      refreshToken: created.refreshToken,
    });
    assert.equal(reused.status, 401);

    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set(bearer(refreshed.body.data.accessToken))
      .send({ refreshToken: refreshed.body.data.refreshToken });
    assert.equal(logout.status, 204);
    const afterLogout = await request(app).post('/api/v1/auth/refresh').send({
      refreshToken: refreshed.body.data.refreshToken,
    });
    assert.equal(afterLogout.status, 401);

    const changed = await request(app)
      .patch(`/api/v1/users/${created.user.id}`)
      .set(bearer(created.accessToken))
      .send({ currentPassword: 'Secretpass1', newPassword: 'Newpass123' });
    assert.equal(changed.status, 200);
    const revoked = await request(app).get('/api/v1/auth/me').set(bearer(created.accessToken));
    assert.equal(revoked.status, 401);
    await login('asha@zorvyn.test', 'Newpass123');

    const badPassword = await request(app).post('/api/v1/auth/login').send({
      email: 'asha@zorvyn.test',
      password: 'wrong-password',
    });
    assert.equal(badPassword.status, 401);
  });

  it('enforces role based access for users, analysts, and admins', async () => {
    const member = await register();
    const admin = await userWithRole('admin');
    const analyst = await userWithRole('analyst');

    const forbidden = await request(app).get('/api/v1/users').set(bearer(member.accessToken));
    assert.equal(forbidden.status, 403);

    const listed = await request(app).get('/api/v1/users').set(bearer(analyst.accessToken));
    assert.equal(listed.status, 200);
    assert.ok(listed.body.meta.total >= 3);

    const escalate = await request(app)
      .patch(`/api/v1/users/${member.user.id}`)
      .set(bearer(member.accessToken))
      .send({ role: 'admin' });
    assert.equal(escalate.status, 403);

    const promoted = await request(app)
      .patch(`/api/v1/users/${member.user.id}`)
      .set(bearer(admin.accessToken))
      .send({ role: 'analyst' });
    assert.equal(promoted.status, 200);
    assert.equal(promoted.body.data.role, 'analyst');

    const account = await openAccount(member.accessToken);
    const hidden = await request(app)
      .get(`/api/v1/accounts/${account.id}`)
      .set(bearer((await register()).accessToken));
    assert.equal(hidden.status, 403);

    const visible = await request(app)
      .get(`/api/v1/accounts/${account.id}`)
      .set(bearer(analyst.accessToken));
    assert.equal(visible.status, 200);

    const analystWrite = await request(app)
      .patch(`/api/v1/accounts/${account.id}`)
      .set(bearer(analyst.accessToken))
      .send({ name: 'Taken over' });
    assert.equal(analystWrite.status, 403);

    const deactivated = await request(app)
      .delete(`/api/v1/users/${member.user.id}`)
      .set(bearer(admin.accessToken));
    assert.equal(deactivated.status, 200);
    assert.equal(deactivated.body.data.isActive, false);
    const stale = await request(app).get('/api/v1/auth/me').set(bearer(member.accessToken));
    assert.equal(stale.status, 401);
  });

  it('creates accounts and categorized transactions, then keeps balances in cents', async () => {
    const member = await register();
    const account = await openAccount(member.accessToken);
    assert.equal(account.currency, 'INR');
    assert.equal(account.balance, '1000.00');

    const expense = await addTransaction(member.accessToken, account.id);
    assert.equal(expense.category.name, 'Food & Dining');
    assert.equal(expense.categorySource, 'rules');
    assert.equal(expense.amount, '240.00');
    assert.equal(expense.account.currency, 'INR');

    const income = await addTransaction(member.accessToken, account.id, {
      type: 'income',
      amount: '85000',
      description: 'Monthly salary from Zorvyn',
      merchant: 'Zorvyn',
    });
    assert.equal(income.category.name, 'Income');

    const balance = await request(app)
      .get(`/api/v1/accounts/${account.id}`)
      .set(bearer(member.accessToken));
    assert.equal(balance.body.data.balance, '85760.00');

    const groceries = (await Category.findOne({ slug: 'groceries' })).id;
    const manual = await addTransaction(member.accessToken, account.id, {
      amount: '10.50',
      description: 'Weekly shop',
      categoryId: groceries,
    });
    assert.equal(manual.category.name, 'Groceries');
    assert.equal(manual.categorySource, 'manual');

    const overdrawn = await request(app)
      .post('/api/v1/transactions')
      .set(bearer(member.accessToken))
      .send({
        accountId: account.id,
        type: 'expense',
        amount: '999999.00',
        description: 'Impossible purchase',
      });
    assert.equal(overdrawn.status, 422);
    assert.equal(overdrawn.body.error.code, 'INSUFFICIENT_FUNDS');
    const stillThere = await Transaction.countDocuments({ description: 'Impossible purchase' });
    assert.equal(stillThere, 0);

    const card = await openAccount(member.accessToken, {
      name: 'Travel Card',
      type: 'credit',
      openingBalance: '20.00',
    });
    assert.equal(card.allowNegative, true);
    const charge = await addTransaction(member.accessToken, card.id, {
      amount: '80.00',
      description: 'Hotel stay',
      merchant: 'Hotel',
    });
    assert.equal(charge.category.name, 'Travel');
    const cardBalance = await request(app)
      .get(`/api/v1/accounts/${card.id}`)
      .set(bearer(member.accessToken));
    assert.equal(cardBalance.body.data.balance, '-60.00');
  });

  it('filters, summarizes, recategorizes, and reverses a deleted transaction', async () => {
    const member = await register();
    const account = await openAccount(member.accessToken, { openingBalance: '5000.00' });
    await addTransaction(member.accessToken, account.id);
    await addTransaction(member.accessToken, account.id, {
      amount: '640.50',
      description: 'Uber ride to the office',
      merchant: 'Uber',
    });
    await addTransaction(member.accessToken, account.id, {
      amount: '1499',
      description: 'Electricity bill April',
    });

    const page = await request(app)
      .get('/api/v1/transactions')
      .query({ limit: 2, sort: '-amount', q: 'uber' })
      .set(bearer(member.accessToken));
    assert.equal(page.status, 200);
    assert.equal(page.body.data.length, 1);
    assert.equal(page.body.data[0].category.name, 'Transport');
    assert.equal(page.body.meta.total, 1);

    const summary = await request(app)
      .get('/api/v1/transactions/summary')
      .set(bearer(member.accessToken));
    assert.equal(summary.status, 200);
    const food = summary.body.data.find((row) => row.category === 'Food & Dining');
    assert.equal(food.total, '240.00');
    assert.equal(food.count, 1);

    const listed = await request(app)
      .get('/api/v1/transactions')
      .query({ limit: 1, sort: 'amount' })
      .set(bearer(member.accessToken));
    assert.equal(listed.body.meta.total, 3);
    assert.equal(listed.body.meta.pages, 3);
    const smallest = listed.body.data[0];

    const preview = await request(app)
      .post('/api/v1/transactions/categorize-preview')
      .set(bearer(member.accessToken))
      .send({ description: 'Netflix subscription', amount: '199', type: 'expense' });
    assert.equal(preview.status, 200);
    assert.equal(preview.body.data.category, 'Entertainment');

    const changed = await request(app)
      .patch(`/api/v1/transactions/${smallest.id}`)
      .set(bearer(member.accessToken))
      .send({
        description: 'Netflix family plan',
        merchant: '',
        recategorize: true,
        amount: '199.00',
      });
    assert.equal(changed.status, 200);
    assert.equal(changed.body.data.category.name, 'Entertainment');
    assert.equal(changed.body.data.amount, '199.00');

    const removed = await request(app)
      .delete(`/api/v1/transactions/${smallest.id}`)
      .set(bearer(member.accessToken));
    assert.equal(removed.status, 204);

    const accountAfter = await request(app)
      .get(`/api/v1/accounts/${account.id}`)
      .set(bearer(member.accessToken));
    // 5000 - 240 - 640.50 - 1499 = 2620.50, then the edited row was the smallest original (240 -> 199)
    // before delete: 5000 - 199 - 640.50 - 1499 = 2661.50. After deleting the 199 row: 2860.50.
    assert.equal(accountAfter.body.data.balance, '2860.50');

    const badId = await request(app)
      .get('/api/v1/transactions/not-a-real-id')
      .set(bearer(member.accessToken));
    assert.equal(badId.status, 400);
  });

  it('lets an admin manage categories and blocks deleting one that is in use', async () => {
    const admin = await userWithRole('admin');
    const member = await register();
    const created = await request(app)
      .post('/api/v1/categories')
      .set(bearer(admin.accessToken))
      .send({ name: 'Pets', kind: 'expense', keywords: ['vet', 'Pet Store'] });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.slug, 'pets');
    assert.deepEqual(created.body.data.keywords, ['vet', 'pet store']);

    const denied = await request(app)
      .post('/api/v1/categories')
      .set(bearer(member.accessToken))
      .send({ name: 'Nope', kind: 'expense' });
    assert.equal(denied.status, 403);

    const account = await openAccount(member.accessToken);
    await addTransaction(member.accessToken, account.id, {
      description: 'Vet visit',
      categoryId: created.body.data.id,
    });
    const blocked = await request(app)
      .delete(`/api/v1/categories/${created.body.data.id}`)
      .set(bearer(admin.accessToken));
    assert.equal(blocked.status, 409);

    const archived = await request(app)
      .delete(`/api/v1/accounts/${account.id}`)
      .set(bearer(member.accessToken));
    assert.equal(archived.status, 200);
    assert.equal(archived.body.data.isArchived, true);
    const hidden = await request(app).get('/api/v1/accounts').set(bearer(member.accessToken));
    assert.equal(hidden.body.data.find((item) => item.id === account.id), undefined);
  });
});
