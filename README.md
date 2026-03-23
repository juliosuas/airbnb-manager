# Airbnb Manager

**Open-source, AI-native multi-property management platform for Airbnb hosts.**

Built for Latin America. Free for your first property. Self-hostable.

---

## What Is This?

Airbnb Manager is a self-hosted (or cloud) platform that helps Airbnb hosts manage multiple properties from a single dashboard. It syncs reservations via iCal (how real Airbnb managers like Hospitable and Guesty work), provides AI-powered guest response suggestions, dynamic pricing, cleaning management, and more.

**Why this exists:** Every competitor (Hospitable $40/mo, Guesty $100+/mo) is US/EU focused, expensive, and closed-source. This is the first open-source alternative with a modern UI and LatAm-first approach.

## Features

- **Authentication** — JWT-based auth, bcrypt passwords, multi-user support
- **Multi-Property** — Manage unlimited properties per account, each fully isolated
- **iCal Sync** — Import reservations from Airbnb, Booking.com, VRBO via iCal URLs. Export your calendar as .ics
- **AI Responses** — Smart message suggestions for common guest questions (check-in, WiFi, restaurants, etc.)
- **Dynamic Pricing** — Weekend multipliers, Mexican holiday premiums, seasonal adjustments, long-stay discounts, demand-based pricing
- **Analytics** — Occupancy rate, revenue tracking, rating monitoring
- **Cleaning Management** — Auto-scheduled tasks tied to checkouts with status tracking
- **Review Tracking** — Monitor and respond to guest reviews
- **Responsive UI** — Dark/light themes, mobile-friendly, skeleton loading states
- **Security** — Helmet.js headers, rate limiting on auth, input validation/sanitization
- **Logging** — Structured logging with Pino

## Quick Start

```bash
# Clone
git clone https://github.com/your-username/airbnb-manager.git
cd airbnb-manager

# Install dependencies
cd backend && npm install

# Configure environment
cp .env.example .env
# Edit .env — at minimum, set JWT_SECRET to a random string

# Seed demo data (creates demo user: demo@airbnbmanager.com / demo1234)
npm run seed

# Start
npm start
# → http://localhost:3001
```

Or use Make from the project root:

```bash
make start    # install + seed + start
make dev      # install + seed + start with --watch
```

Then visit:
- **Landing page:** http://localhost:3001/landing
- **Sign in:** http://localhost:3001/login
- **Onboarding:** http://localhost:3001/onboarding
- **Dashboard:** http://localhost:3001 (requires login)

**Demo credentials:** `demo@airbnbmanager.com` / `demo1234`

## Docker

```bash
# Build and run
docker compose up --build

# Or with Make
make docker
```

The Docker setup uses a multi-stage build with `node:20-alpine`. Database is persisted via volume mount at `./backend/db`.

Set `JWT_SECRET` in your environment or `.env` file before running in production.

## Architecture

```
backend/              Node.js + Express API (port 3001)
  ├── db/             SQLite database, schema, seed data
  │   └── schema.sql  Multi-tenant schema (users, properties, reservations...)
  ├── middleware/      Auth (JWT), error handling, input validation
  ├── services/       AI responder, pricing engine, iCal, notifications
  └── server.js       Main server with all routes
frontend/             Vanilla HTML/CSS/JS (served by Express)
  ├── index.html      Dashboard SPA
  ├── login.html      Sign-in page
  ├── landing.html    Marketing / landing page
  ├── onboarding.html 4-step setup wizard
  ├── app.js          Dashboard logic
  └── style.css       Design system
```

## API Documentation

### Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Create account (rate limited) |
| POST | `/api/auth/login` | No | Login, get JWT (rate limited) |
| GET | `/api/auth/me` | Yes | Current user info |

### Properties

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/properties` | Yes | List user's properties |
| POST | `/api/properties` | Yes | Add a property |
| GET | `/api/properties/:id` | Yes | Get property details |
| PUT | `/api/properties/:id` | Yes | Update property |
| DELETE | `/api/properties/:id` | Yes | Delete property |

### Property-Scoped Resources

All data is scoped per property:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/properties/:id/reservations` | Reservations for property |
| GET | `/api/properties/:id/calendar` | Calendar data |
| GET | `/api/properties/:id/messages` | Guest messages |
| GET | `/api/properties/:id/analytics` | Stats and metrics |
| GET | `/api/properties/:id/reviews` | Reviews |
| GET | `/api/properties/:id/cleaning` | Cleaning tasks |

### iCal Integration

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/properties/:id/ical/sync` | Import from iCal URL |
| GET | `/api/properties/:id/ical/export` | Export as .ics file |
| GET | `/api/ical/:id.ics` | Public .ics URL (no auth, for sharing) |

### Legacy Routes (backward compatible, no auth required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/property` | First property (legacy) |
| GET | `/api/reservations` | All reservations |
| GET | `/api/calendar` | Calendar data |
| GET | `/api/messages` | Messages |
| POST | `/api/messages/send` | Send message |
| POST | `/api/messages/suggest` | AI suggestions |
| GET | `/api/analytics` | Dashboard stats |
| POST | `/api/pricing` | Update pricing |
| GET | `/api/pricing/calculate` | Calculate stay price |
| GET | `/api/reviews` | Reviews |
| GET | `/api/cleaning` | Cleaning tasks |
| PATCH | `/api/cleaning/:id` | Update cleaning status |

## Environment Variables

Copy `backend/.env.example` to `backend/.env`:

```env
PORT=3001
DB_PATH=./db/airbnb.db

# REQUIRED — change in production
JWT_SECRET=change-me-to-a-random-secret-in-production
JWT_EXPIRES_IN=7d

# OpenAI (optional — for AI responses)
OPENAI_API_KEY=

# Pricing defaults
BASE_PRICE=1500
WEEKEND_MULTIPLIER=1.3
CURRENCY=MXN

# Notification webhook (optional)
NOTIFICATION_WEBHOOK_URL=
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Node.js + Express |
| Database | SQLite (WAL mode, better-sqlite3) |
| Auth | JWT + bcrypt |
| Security | helmet.js, express-rate-limit, input validation |
| Logging | Pino (structured JSON) |
| Frontend | Vanilla HTML/CSS/JS |
| Icons | Lucide (CDN) |
| Fonts | Inter (Google Fonts) |
| iCal | Custom parser (no external deps) |

## Roadmap

- [x] Multi-tenant auth + multi-property
- [x] iCal import/export
- [x] Landing page + onboarding
- [x] Security hardening (helmet, rate limiting, validation)
- [x] Structured logging
- [x] Docker support
- [ ] Real AI responses (OpenAI/Claude)
- [ ] WhatsApp notifications
- [ ] Dynamic pricing with ML
- [ ] Multi-platform sync (Booking.com, VRBO)
- [ ] Mobile app (PWA)
- [ ] Payment tracking
- [ ] Cleaning team management with photo verification

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. We welcome PRs!

## License

MIT — see [LICENSE](LICENSE)
