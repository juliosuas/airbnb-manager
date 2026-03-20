# 🏠 Airbnb Manager

**Open-source, AI-native multi-property management platform for Airbnb hosts.**

Built for Latin America. Free for your first property. Self-hostable.

---

## What Is This?

Airbnb Manager is a self-hosted (or cloud) platform that helps Airbnb hosts manage multiple properties from a single dashboard. It syncs reservations via iCal (how real Airbnb managers like Hospitable and Guesty work), provides AI-powered guest response suggestions, dynamic pricing, cleaning management, and more.

**Why this exists:** Every competitor (Hospitable $40/mo, Guesty $100+/mo) is US/EU focused, expensive, and closed-source. This is the first open-source alternative with a modern UI and LatAm-first approach.

## Features

- **🔐 Authentication** — JWT-based auth, bcrypt passwords, multi-user support
- **🏠 Multi-Property** — Manage unlimited properties per account, each fully isolated
- **📅 iCal Sync** — Import reservations from Airbnb, Booking.com, VRBO via iCal URLs. Export your calendar as .ics
- **🤖 AI Responses** — Smart message suggestions for common guest questions (check-in, WiFi, restaurants, etc.)
- **💰 Dynamic Pricing** — Weekend multipliers, Mexican holiday premiums, seasonal adjustments, long-stay discounts, demand-based pricing
- **📊 Analytics** — Occupancy rate, revenue tracking, rating monitoring
- **🧹 Cleaning Management** — Auto-scheduled tasks tied to checkouts with status tracking
- **⭐ Review Tracking** — Monitor and respond to guest reviews
- **📱 Responsive UI** — Dark/light themes, mobile-friendly, skeleton loading states

## Quick Start

```bash
# Clone
git clone https://github.com/your-username/airbnb-manager.git
cd airbnb-manager

# Install dependencies
cd backend && npm install

# Seed demo data (creates demo user: demo@airbnbmanager.com / demo1234)
npm run seed

# Start
npm start
# → http://localhost:3001

# Or use Make
cd .. && make start
```

Then visit:
- **Landing page:** http://localhost:3001/landing
- **Onboarding:** http://localhost:3001/onboarding
- **Dashboard:** http://localhost:3001

## Architecture

```
backend/              Node.js + Express API (port 3001)
  ├── db/             SQLite database, schema, seed data
  │   └── schema.sql  Multi-tenant schema (users, properties, reservations...)
  ├── middleware/      JWT auth middleware
  ├── services/       AI responder, pricing engine, iCal, notifications
  └── server.js       Main server with all routes
frontend/             Vanilla HTML/CSS/JS (served by Express)
  ├── index.html      Dashboard (existing, backward-compatible)
  ├── landing.html    Marketing / landing page
  ├── onboarding.html 4-step setup wizard
  ├── app.js          Dashboard logic
  └── style.css       Design system
```

## API Documentation

### Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Create account |
| POST | `/api/auth/login` | No | Login, get JWT |
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

## iCal Sync — How It Works

Airbnb doesn't have a public API. Instead, hosts can export their calendar as an iCal (.ics) URL:

1. Go to **Airbnb → Your Listing → Availability → Calendar Sync**
2. Click **Export Calendar** and copy the URL
3. Add it to your property in Airbnb Manager
4. We parse the iCal feed to extract reservations, blocked dates, and availability
5. Sync runs on-demand or can be scheduled

This is the same method used by Hospitable, Guesty, OwnerRez, and every other serious Airbnb management tool.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Node.js + Express |
| Database | SQLite (WAL mode, better-sqlite3) |
| Auth | JWT + bcrypt |
| Frontend | Vanilla HTML/CSS/JS |
| Icons | Lucide (CDN) |
| Fonts | Inter (Google Fonts) |
| iCal | Custom parser (no external deps) |

## Environment Variables

Copy `backend/.env.example` to `backend/.env`:

```env
PORT=3001
DB_PATH=./db/airbnb.db
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
BASE_PRICE=1500
CURRENCY=MXN
WEEKEND_MULTIPLIER=1.3
NOTIFICATION_WEBHOOK_URL=
```

## Roadmap

- [x] Multi-tenant auth + multi-property
- [x] iCal import/export
- [x] Landing page + onboarding
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
