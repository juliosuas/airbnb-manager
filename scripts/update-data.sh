#!/usr/bin/env bash
# update-data.sh — Fetch Airbnb iCal, parse reservations, update data.json, push to GitHub
# Usage: ./scripts/update-data.sh
# Requires: curl, python3 (or awk/sed for lightweight parsing)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
DOCS_DIR="$REPO_DIR/docs"
DATA_FILE="$DOCS_DIR/data.json"
ICAL_URL="https://www.airbnb.com/calendar/ical/840626167478183381.ics?t=6b3ae189fe1e4ceead4d1f933eb8615f"
ICAL_TMP="/tmp/airbnb-calendar.ics"

echo "📅 Fetching Airbnb iCal feed..."
curl -sL "$ICAL_URL" -o "$ICAL_TMP"

if [ ! -s "$ICAL_TMP" ]; then
  echo "❌ Failed to fetch iCal feed or empty response"
  exit 1
fi

echo "🔍 Parsing calendar data..."

# Use Python for reliable iCal parsing
python3 << 'PYEOF'
import json
import re
from datetime import datetime, date

ical_path = "/tmp/airbnb-calendar.ics"
output_path = __import__("os").environ.get("DATA_FILE", "docs/data.json")

with open(ical_path, "r") as f:
    content = f.read()

# Parse VEVENT blocks
events = []
blocks = re.split(r"BEGIN:VEVENT", content)[1:]  # skip preamble

for block in blocks:
    ev = {}
    for line in block.splitlines():
        if line.startswith("DTSTART"):
            m = re.search(r"(\d{8})", line)
            if m:
                ev["start"] = m.group(1)
        elif line.startswith("DTEND"):
            m = re.search(r"(\d{8})", line)
            if m:
                ev["end"] = m.group(1)
        elif line.startswith("SUMMARY"):
            ev["summary"] = line.split(":", 1)[-1].strip()
        elif line.startswith("DESCRIPTION"):
            ev["description"] = line.split(":", 1)[-1].strip()
    if "start" in ev:
        events.append(ev)

today = date.today()
current_month = today.month
current_year = today.year

reservations = []
blocked_dates = []
available_this_month = 0
blocked_this_month = 0

# Track which days this month are blocked
import calendar
days_in_month = calendar.monthrange(current_year, current_month)[1]
blocked_days_set = set()

for ev in events:
    start_str = ev.get("start", "")
    end_str = ev.get("end", start_str)
    summary = ev.get("summary", "")

    try:
        start_date = datetime.strptime(start_str, "%Y%m%d").date()
        end_date = datetime.strptime(end_str, "%Y%m%d").date()
    except ValueError:
        continue

    # Check if it's a reservation or blocked
    is_reservation = "reserved" in summary.lower() or "airbnb" in summary.lower() or "reservation" in summary.lower() or (ev.get("description", "") and "reservation" in ev.get("description", "").lower())

    if is_reservation or "not available" not in summary.lower():
        nights = (end_date - start_date).days
        if nights > 0:
            reservations.append({
                "guest": summary or "Reservación",
                "checkIn": start_date.isoformat(),
                "checkOut": end_date.isoformat(),
                "nights": nights,
                "status": "confirmed"
            })

    # Mark blocked days in current month
    d = start_date
    while d < end_date:
        if d.year == current_year and d.month == current_month:
            blocked_days_set.add(d.day)
        d = d.replace(day=d.day) if d.day < 28 else d  # safe increment
        from datetime import timedelta
        d += timedelta(days=1)

    blocked_dates.append({
        "start": start_date.isoformat(),
        "end": end_date.isoformat(),
        "reason": summary
    })

blocked_this_month = len(blocked_days_set)
available_this_month = days_in_month - blocked_this_month

# Sort reservations by check-in, keep only future ones
reservations = [r for r in reservations if r["checkIn"] >= today.isoformat()]
reservations.sort(key=lambda x: x["checkIn"])

# Build output
data = {
    "lastUpdated": datetime.utcnow().isoformat() + "Z",
    "calendar": {
        "blockedDates": blocked_dates,
        "reservations": reservations[:10],  # keep top 10 upcoming
        "availableDaysThisMonth": available_this_month,
        "blockedDaysThisMonth": blocked_this_month
    },
    "messages": {
        "unread": 0,
        "lastMessage": None
    },
    "stats": {
        "totalEarnings": 0,
        "averageRating": 0,
        "totalReviews": 0
    }
}

with open(output_path, "w") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"✅ Parsed {len(events)} events, {len(reservations)} upcoming reservations")
print(f"📊 This month: {available_this_month} available / {blocked_this_month} blocked days")
PYEOF

export DATA_FILE="$DATA_FILE"

echo "📤 Committing and pushing to GitHub..."
cd "$REPO_DIR"
git add docs/data.json
git diff --cached --quiet && echo "ℹ️  No changes to data.json" && exit 0

git commit -m "🔄 Auto-update calendar data $(date '+%Y-%m-%d %H:%M')"
git push origin main

echo "✅ Dashboard data updated and pushed!"
