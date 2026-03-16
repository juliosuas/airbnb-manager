# 🏠 Airbnb Manager — Casa Sol

Self-hosted platform to manage one Airbnb property with AI. Built for Casa Sol in Playa del Carmen, Mexico.

## Quick Start

```bash
make start
# → Backend API at http://localhost:3001
# → Dashboard at http://localhost:3001
```

## Architecture

```
backend/          Node.js + Express API (port 3001)
  ├── db/         SQLite database + schema + seed data
  ├── services/   AI responder, pricing engine, notifications
  └── airbnb/     Airbnb API client (placeholder for real API)
ai/               Python bridge for airbnb-host-api + AI responder
frontend/         Vanilla HTML/CSS/JS dashboard (served by Express)
```

## Features

- **Dashboard** — Property overview, stats, upcoming check-ins
- **Calendar** — Visual monthly grid with pricing and availability
- **Messages** — Guest inbox with AI-powered response suggestions
- **Reservations** — Full list with status filtering
- **Pricing** — Dynamic pricing engine (weekends, holidays, seasons, demand)
- **Cleaning** — Schedule tracker tied to checkouts
- **Reviews** — Display and respond to guest reviews

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Health check |
| GET | /api/property | Property details |
| GET | /api/reservations | List reservations |
| GET | /api/calendar | Calendar data |
| GET | /api/messages | Guest messages |
| POST | /api/messages/send | Send message |
| POST | /api/messages/suggest | AI response suggestions |
| GET | /api/analytics | Stats and metrics |
| POST | /api/pricing | Update pricing |
| GET | /api/pricing/calculate | Calculate stay price |
| GET | /api/reviews | List reviews |
| GET | /api/cleaning | Cleaning tasks |
| PATCH | /api/cleaning/:id | Update cleaning status |

## AI Engine

Template-based auto-responder handles:
- Booking inquiries
- Check-in/out instructions
- WiFi and amenities questions
- Restaurant recommendations
- Emergency contacts

## Pricing Engine

Dynamic pricing with:
- Weekend multiplier (Fri-Sat: 1.3x)
- High season (Dec-Mar, Jul-Aug: 1.25x)
- Mexican holiday premiums (1.5x)
- Last-minute discounts (≤3 days: 15% off)
- Long-stay discounts (7+ nights: 10%, 28+: 25%)
- Demand-based adjustment

## Configuration

Copy `backend/.env.example` to `backend/.env` and fill in your values.

## Future Integrations

- Real Airbnb API via `airbnb-host-api` Python package
- WhatsApp notifications via Jeffrey
- OpenAI-powered guest responses
- Multi-property support
