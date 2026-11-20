# Zorvyn FinTech API

REST backend for recording accounts and transactions. Passwords are hashed, sessions use signed JWTs, and every protected route checks the caller's role. Transaction descriptions are categorized automatically with an OpenAI-compatible LLM, and with keyword rules when that API is not configured.

## Stack

- Node.js 20+ and Express
- MongoDB and Mongoose
- Zod request validation
- JWT access tokens and revocable refresh tokens
- Roles: `user`, `analyst`, `admin`

## Run locally

```bash
cp .env.example .env
# Start MongoDB, or: docker compose up mongo -d
npm install
npm run seed -- --demo
npm run dev
```

The API listens on port 4000. `GET /health` returns the process and MongoDB status.

Demo seed login: `demo@zorvyn.local` / `Demopass1`. The admin user comes from `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`.

`docker compose up --build` starts MongoDB and the API together. Set real `JWT_SECRET` and `JWT_REFRESH_SECRET` values before using that outside your machine.

## Auth and roles

| Role | Access |
| --- | --- |
| user | Create and manage their own accounts and transactions. Read categories. |
| analyst | Read users, accounts, and transactions across the book. Cannot change someone else's records. |
| admin | Everything above, plus user creation, role changes, deactivation, and category management. |

Register always creates a `user`. An administrator promotes people afterward. Access tokens expire quickly (15 minutes by default). Send `POST /api/v1/auth/refresh` with the refresh token to rotate it. Logout and deactivation revoke refresh tokens. Every request loads the user, so a deactivated account cannot keep calling the API. Changing a password bumps a token version and rejects access tokens issued before that change.

Amounts are decimal strings in JSON (`"240.00"`) and integer cents in MongoDB.

## Categorization

`POST /api/v1/transactions` assigns a category when `categoryId` is omitted. The same helper powers `POST /api/v1/transactions/categorize-preview` and `POST /api/v1/transactions/:id/categorize`.

Set `LLM_API_KEY` to call `POST {LLM_BASE_URL}/chat/completions` (OpenAI, Groq, OpenRouter, or any compatible gateway). The model must return JSON:

```json
{"category":"Transport","confidence":0.93,"reason":"Ride hail"}
```

The category has to be one of the names stored in MongoDB. A timeout, HTTP error, or unknown label falls back to the keyword rules seeded with the default categories, so a create still succeeds.

## API

All JSON bodies use this shape:

```json
{ "success": true, "data": {}, "meta": { "page": 1, "limit": 20, "total": 1, "pages": 1 } }
```

Errors:

```json
{ "success": false, "error": { "message": "Request validation failed", "code": "VALIDATION_ERROR", "details": [], "requestId": "..." } }
```

| Method | Path | Who |
| --- | --- | --- |
| POST | `/api/v1/auth/register` | public |
| POST | `/api/v1/auth/login` | public |
| POST | `/api/v1/auth/refresh` | public |
| POST | `/api/v1/auth/logout` | signed in |
| GET | `/api/v1/auth/me` | signed in |
| POST | `/api/v1/users` | admin |
| GET | `/api/v1/users` | admin, analyst |
| GET | `/api/v1/users/:id` | self, admin, analyst |
| PATCH | `/api/v1/users/:id` | self or admin; only admin can set `role` or `isActive` |
| DELETE | `/api/v1/users/:id` | admin, deactivates the user |
| POST/GET | `/api/v1/accounts` | signed in; users see their own |
| GET/PATCH/DELETE | `/api/v1/accounts/:id` | owner or admin for writes; analyst can read. Delete archives. |
| GET | `/api/v1/categories` | signed in |
| POST/PATCH/DELETE | `/api/v1/categories` | admin |
| POST/GET | `/api/v1/transactions` | signed in |
| GET | `/api/v1/transactions/summary` | signed in |
| POST | `/api/v1/transactions/categorize-preview` | signed in |
| GET/PATCH/DELETE | `/api/v1/transactions/:id` | owner or admin for writes; analyst can read |
| POST | `/api/v1/transactions/:id/categorize` | owner or admin |

List endpoints accept `page` and `limit` (max 100). Transactions also accept `accountId`, `categoryId`, `type`, `from`, `to`, `q`, and `sort` (`date`, `amount`, `createdAt`, prefix `-` for descending).

Creating an expense on a checking, savings, cash, or investment account fails with `422 INSUFFICIENT_FUNDS` when the balance would go negative. Credit accounts allow a negative balance unless `allowNegative` is set to `false`. The balance update uses a conditional `$inc`, and a failed balance update removes the transaction that was just inserted.

## Tests

```bash
npm test
```

The suite starts an in-memory MongoDB, covers validation, auth, RBAC, balances, and categorization, and mocks the LLM HTTP call.
