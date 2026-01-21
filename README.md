# Crowdfunding Backend

REST API backend pro crowdfundingovou platformu postavený na Node.js, Express a MongoDB.

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express.js
- **Database:** MongoDB (Mongoose ODM)
- **Validace:** Zod
- **Auth:** Session-based (bcrypt + secure cookies)

## Quick Start

```bash
# Instalace
npm install

# Konfigurace
cp .env.example .env
# Uprav .env s MongoDB URI

# Development
npm run dev

# Build
npm run build
npm start
```

## API Endpoints

### Auth `/api/auth`
| Method | Endpoint | Popis | Auth |
|--------|----------|-------|------|
| POST | `/register` | Registrace nového uživatele | - |
| POST | `/login` | Přihlášení | - |
| POST | `/logout` | Odhlášení | ✓ |
| POST | `/refresh` | Obnovení session | ✓ |

### Users `/api/users`
| Method | Endpoint | Popis | Auth |
|--------|----------|-------|------|
| GET | `/me` | Aktuální uživatel | ✓ |
| PATCH | `/me` | Upravit profil | ✓ |
| GET | `/me/contributions` | Moje příspěvky | ✓ |
| GET | `/me/projects` | Moje projekty | ✓ |
| GET | `/:id` | Veřejný profil | - |

### Projects `/api/projects`
| Method | Endpoint | Popis | Auth |
|--------|----------|-------|------|
| GET | `/` | Seznam projektů | - |
| GET | `/:id` | Detail projektu | - |
| POST | `/` | Vytvořit projekt | ✓ founder |
| PATCH | `/:id` | Upravit projekt | ✓ owner |
| DELETE | `/:id` | Smazat draft | ✓ owner |
| POST | `/:id/submit` | Odeslat ke schválení | ✓ owner |

### Rewards `/api/projects/:projectId/rewards`
| Method | Endpoint | Popis | Auth |
|--------|----------|-------|------|
| GET | `/` | Seznam odměn | - |
| POST | `/` | Přidat odměnu | ✓ owner |
| PATCH | `/:rewardId` | Upravit odměnu | ✓ owner |
| DELETE | `/:rewardId` | Smazat odměnu | ✓ owner |

### Contributions `/api/contributions`
| Method | Endpoint | Popis | Auth |
|--------|----------|-------|------|
| POST | `/` | Vytvořit příspěvek | ✓/- |
| GET | `/:id` | Detail příspěvku | ✓ owner |
| POST | `/:id/refund` | Požádat o refund | ✓ owner |

### Payments `/api/payments`
| Method | Endpoint | Popis | Auth |
|--------|----------|-------|------|
| POST | `/webhook/stripe` | Stripe webhook | signature |
| POST | `/webhook/gopay` | GoPay webhook | signature |

### Admin `/api/admin`
| Method | Endpoint | Popis | Auth |
|--------|----------|-------|------|
| GET | `/projects/pending` | Projekty ke schválení | ✓ admin |
| POST | `/projects/:id/publish` | Publikovat projekt | ✓ admin |
| POST | `/projects/:id/reject` | Zamítnout projekt | ✓ admin |
| GET | `/users` | Seznam uživatelů | ✓ admin |
| PATCH | `/users/:id/roles` | Změnit role | ✓ admin |
| GET | `/audit-logs` | Audit log | ✓ admin |
| GET | `/stats` | Dashboard statistiky | ✓ admin |

## Database Schema

### Collections

#### `users`
- email (unique), passwordHash, firstName, lastName
- roles: `user` | `founder` | `admin`
- stats: { totalContributed, totalProjectsOwned }

#### `sessions`
- userId, tokenHash, expiresAt (TTL index)
- ip, userAgent

#### `projects`
- ownerId, title, shortDescription, description
- category, images[], targetAmount, currency
- status: `draft` | `pendingApproval` | `active` | `successful` | `failed` | `rejected`
- rewards[] (embedded)
- stats: { currentAmount, backerCount }

#### `contributions`
- userId, projectId, rewardId
- amount, currency, status
- payment: { provider, intentId, chargeId, raw }

#### `paymentEvents`
- provider, externalEventId (unique compound)
- type, payload, signatureValid
- contributionId

#### `auditLogs`
- entity: { type, id }
- action, actorUserId, source
- dataBefore, dataAfter

## Project Structure

```
src/
├── api/
│   ├── app.ts              # Express app
│   ├── server.ts           # Server entry point
│   ├── middlewares/
│   │   ├── auth.ts         # Session authentication
│   │   ├── requireRole.ts  # Role-based access
│   │   ├── validate.ts     # Zod validation
│   │   └── errorHandler.ts # Error handling
│   └── routes/
│       ├── auth.ts
│       ├── users.ts
│       ├── projects.ts
│       ├── contributions.ts
│       ├── payments.ts
│       └── admin.ts
├── config/
│   └── database.ts         # MongoDB connection
├── models/
│   ├── User.ts
│   ├── Session.ts
│   ├── Project.ts
│   ├── Contribution.ts
│   ├── PaymentEvent.ts
│   └── AuditLog.ts
├── services/
│   ├── authService.ts
│   ├── userService.ts
│   ├── projectService.ts
│   ├── rewardService.ts
│   ├── contributionService.ts
│   ├── paymentService.ts
│   └── auditService.ts
├── types/
│   └── index.ts            # TypeScript types & enums
├── validators/
│   └── schemas.ts          # Zod schemas
└── scripts/
    ├── test-connection.ts
    └── init-database.ts
```

## Environment Variables

```env
# MongoDB
MONGODB_URI=mongodb+srv://...

# Server
PORT=4000
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:3000

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

## Stripe Setup

### 1. Vytvoření Stripe účtu

1. Registruj se na [stripe.com](https://stripe.com)
2. Přejdi do **Developers > API keys**
3. Zkopíruj **Secret key** (`sk_test_...`) do `.env` jako `STRIPE_SECRET_KEY`

### 2. Frontend konfigurace

V `.env` frontendu přidej **Publishable key** (`pk_test_...`):

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

### 3. Webhook pro lokální vývoj

Pro zpracování platebních událostí (succeeded, failed) potřebuješ webhook. Pro lokální vývoj použij Stripe CLI:

```bash
# Instalace Stripe CLI
# macOS
brew install stripe/stripe-cli/stripe

# Windows (Scoop)
scoop install stripe

# Login
stripe login

# Forwardování webhooků na lokální server
stripe listen --forward-to localhost:4000/api/payments/webhook/stripe
```

Stripe CLI vypíše webhook signing secret (`whsec_...`), který vlož do `.env`:

```env
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### 4. Testování plateb

Použij testovací karty:

| Číslo karty | Výsledek |
|-------------|----------|
| `4242 4242 4242 4242` | Úspěšná platba |
| `4000 0000 0000 3220` | 3D Secure autentizace |
| `4000 0000 0000 9995` | Zamítnutá platba |

Ostatní údaje:
- **Expirace:** Jakékoliv budoucí datum (např. 12/34)
- **CVC:** Jakékoliv 3 číslice (např. 123)
- **ZIP:** Jakékoliv (např. 12345)

### 5. Produkční nasazení

Pro produkci:

1. Aktivuj Stripe účet (KYC verifikace)
2. Přepni na **Live keys** v Stripe Dashboard
3. Vytvoř produkční webhook endpoint v **Developers > Webhooks**
4. Nastav URL: `https://tvoje-domena.com/api/payments/webhook/stripe`
5. Vyber events: `payment_intent.succeeded`, `payment_intent.payment_failed`
6. Zkopíruj produkční webhook secret do produkčního `.env`

## Scripts

```bash
npm run dev        # Development server (tsx watch)
npm run build      # TypeScript build
npm run start      # Production server
npm run typecheck  # Type checking
```

## User Roles

| Role | Permissions |
|------|-------------|
| `user` | Browse projects, contribute, manage own contributions |
| `founder` | Create projects, manage own projects and rewards |
| `admin` | Approve/reject projects, manage users, view audit logs |

## Project Status Flow

```
draft → pendingApproval → active → successful/failed
                       ↘ rejected
```

## License

ISC
