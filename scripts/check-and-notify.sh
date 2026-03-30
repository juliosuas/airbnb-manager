#!/usr/bin/env bash
# check-and-notify.sh — Fetch iCal, update dashboard, notify Julio if changes
# Runs 5x daily via cron. Sends WhatsApp alert on new bookings/blocks.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
DATA_FILE="$REPO_DIR/docs/data.json"
STATE_FILE="/Users/magi/jeffrey/workspace/memory/airbnb-bookings.json"
ICAL_URL="https://www.airbnb.com/calendar/ical/840626167478183381.ics?t=6b3ae189fe1e4ceead4d1f933eb8615f"
ICAL_TMP="/tmp/airbnb-calendar.ics"
LOG="/tmp/airbnb-check.log"

echo "[$(date)] Starting Airbnb check..." >> "$LOG"

# 1. Fetch iCal
curl -sL "$ICAL_URL" -o "$ICAL_TMP"
if [ ! -s "$ICAL_TMP" ]; then
  echo "[$(date)] ERROR: Empty iCal response" >> "$LOG"
  exit 1
fi

# 2. Parse and detect changes vs last state
python3 << PYEOF >> "$LOG" 2>&1
import json
import re
import os
from datetime import datetime, date, timedelta

ical_path = "/tmp/airbnb-calendar.ics"
state_file = "$STATE_FILE"
data_file = "$DATA_FILE"

with open(ical_path, "r") as f:
    content = f.read()

# Parse events
events = []
blocks = re.split(r"BEGIN:VEVENT", content)[1:]
for block in blocks:
    ev = {}
    for line in block.splitlines():
        if line.startswith("DTSTART"):
            m = re.search(r"(\d{8})", line)
            if m: ev["dtstart"] = m.group(1)
        elif line.startswith("DTEND"):
            m = re.search(r"(\d{8})", line)
            if m: ev["dtend"] = m.group(1)
        elif line.startswith("SUMMARY"):
            ev["summary"] = line.split(":", 1)[-1].strip()
        elif line.startswith("UID"):
            ev["uid"] = line.split(":", 1)[-1].strip()
    if "dtstart" in ev and "uid" in ev:
        events.append(ev)

today = date.today()

# Load previous state
prev_uids = set()
if os.path.exists(state_file):
    try:
        with open(state_file) as f:
            prev = json.load(f)
            prev_uids = {e["uid"] for e in prev.get("events", [])}
    except:
        pass

# Find new events
new_events = [e for e in events if e["uid"] not in prev_uids]

# Save new state
with open(state_file, "w") as f:
    json.dump({
        "lastChecked": datetime.utcnow().isoformat() + "Z",
        "events": events
    }, f, indent=2)

# Update data.json
import calendar as cal_mod
current_year = today.year
current_month = today.month
days_in_month = cal_mod.monthrange(current_year, current_month)[1]
blocked_days_set = set()
blocked_dates = []
reservations = []

for ev in events:
    start_str = ev.get("dtstart", "")
    end_str = ev.get("dtend", start_str)
    summary = ev.get("summary", "Airbnb (Not available)")
    try:
        start_date = datetime.strptime(start_str, "%Y%m%d").date()
        end_date = datetime.strptime(end_str, "%Y%m%d").date()
    except:
        continue
    d = start_date
    while d < end_date:
        if d.year == current_year and d.month == current_month:
            blocked_days_set.add(d.day)
        d += timedelta(days=1)
    blocked_dates.append({"start": start_date.isoformat(), "end": end_date.isoformat(), "reason": summary})
    if end_date >= today:
        nights = (end_date - start_date).days
        reservations.append({"guest": summary, "checkIn": start_date.isoformat(), "checkOut": end_date.isoformat(), "nights": nights, "status": "confirmed"})

reservations.sort(key=lambda x: x["checkIn"])
blocked_this_month = len(blocked_days_set)
available_this_month = days_in_month - blocked_this_month

# Load existing data.json to preserve stats
existing = {}
if os.path.exists(data_file):
    try:
        with open(data_file) as f:
            existing = json.load(f)
    except:
        pass

data = {
    "lastUpdated": datetime.utcnow().isoformat() + "Z",
    "calendar": {
        "blockedDates": blocked_dates,
        "reservations": reservations[:10],
        "availableDaysThisMonth": available_this_month,
        "blockedDaysThisMonth": blocked_this_month
    },
    "messages": existing.get("messages", {"unread": 0, "lastMessage": None}),
    "stats": existing.get("stats", {"totalEarnings": 0, "averageRating": 0, "totalReviews": 0})
}

with open(data_file, "w") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"Parsed {len(events)} events, {len(reservations)} upcoming, {len(new_events)} NEW")

# Output new events for bash to read
if new_events:
    with open("/tmp/airbnb-new-events.json", "w") as f:
        json.dump(new_events, f)
    print("NEW_EVENTS_FOUND")
else:
    if os.path.exists("/tmp/airbnb-new-events.json"):
        os.remove("/tmp/airbnb-new-events.json")
    print("NO_NEW_EVENTS")
PYEOF

# 3. Commit and push dashboard update
cd "$REPO_DIR"
git add docs/data.json
if ! git diff --cached --quiet; then
    git commit -m "🔄 Auto-update calendar data $(date '+%Y-%m-%d %H:%M')"
    git push origin main
    echo "[$(date)] Dashboard pushed to GitHub" >> "$LOG"
else
    echo "[$(date)] No changes to push" >> "$LOG"
fi

# 4. Send WhatsApp notification if new events found
if [ -f "/tmp/airbnb-new-events.json" ]; then
    python3 << PYEOF2
import json
import subprocess

with open("/tmp/airbnb-new-events.json") as f:
    new_events = json.load(f)

msg_lines = ["🏠 *Airbnb — Nueva actividad detectada*\n"]
for ev in new_events:
    start = ev.get("dtstart", "")
    end = ev.get("dtend", "")
    # Format dates nicely
    try:
        from datetime import datetime
        s = datetime.strptime(start, "%Y%m%d").strftime("%d %b %Y")
        e = datetime.strptime(end, "%Y%m%d").strftime("%d %b %Y")
        msg_lines.append(f"📅 {s} → {e}")
    except:
        msg_lines.append(f"📅 {start} → {end}")
    msg_lines.append(f"📋 {ev.get('summary', 'Sin descripción')}")
    msg_lines.append("")

msg_lines.append("Dashboard: https://julio-airbnb.github.io/airbnb-manager/")

msg = "\n".join(msg_lines)

# Send via openclaw message tool
result = subprocess.run(
    ["node", "-e", f"""
const {{execSync}} = require('child_process');
// Use openclaw CLI to send WhatsApp message
process.stdout.write('SENDING');
"""],
    capture_output=True, text=True
)

# Write message to a tmp file for the shell to pick up
with open("/tmp/airbnb-notify-msg.txt", "w") as f:
    f.write(msg)

print("Message prepared")
PYEOF2

    # Send the message via openclaw
    MSG=$(cat /tmp/airbnb-notify-msg.txt)
    openclaw message send --channel whatsapp --to "+5215614963583" --message "$MSG" 2>/dev/null || \
    echo "[$(date)] WARNING: Could not send WhatsApp notification" >> "$LOG"
    
    echo "[$(date)] New events found - notification sent" >> "$LOG"
fi

echo "[$(date)] Check complete." >> "$LOG"
