/**
 * iCal Integration Service
 * 
 * Airbnb exports calendars as .ics (iCal) URLs.
 * This is how ALL real Airbnb managers work — Hospitable, Guesty, OwnerRez, etc.
 * 
 * Import: Fetch .ics URL → parse VEVENT → create/update reservations
 * Export: Generate .ics from property calendar → share URL
 */

// Simple iCal parser — no external dependency needed
function parseICS(icsText) {
  const events = [];
  const lines = icsText.replace(/\r\n /g, '').split(/\r?\n/);
  let currentEvent = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      currentEvent = {};
    } else if (line === 'END:VEVENT' && currentEvent) {
      events.push(currentEvent);
      currentEvent = null;
    } else if (currentEvent) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;

      let key = line.substring(0, colonIdx);
      const value = line.substring(colonIdx + 1);

      // Strip parameters (e.g., DTSTART;VALUE=DATE:20260315 → DTSTART)
      const semiIdx = key.indexOf(';');
      if (semiIdx !== -1) key = key.substring(0, semiIdx);

      switch (key) {
        case 'UID':
          currentEvent.uid = value;
          break;
        case 'DTSTART':
          currentEvent.start = parseICalDate(value);
          break;
        case 'DTEND':
          currentEvent.end = parseICalDate(value);
          break;
        case 'SUMMARY':
          currentEvent.summary = unescapeICS(value);
          break;
        case 'DESCRIPTION':
          currentEvent.description = unescapeICS(value);
          break;
        case 'STATUS':
          currentEvent.status = value;
          break;
        case 'LOCATION':
          currentEvent.location = unescapeICS(value);
          break;
      }
    }
  }

  return events;
}

function parseICalDate(value) {
  // Formats: 20260315 or 20260315T150000 or 20260315T150000Z
  if (value.length >= 8) {
    const y = value.substring(0, 4);
    const m = value.substring(4, 6);
    const d = value.substring(6, 8);
    return `${y}-${m}-${d}`;
  }
  return value;
}

function unescapeICS(text) {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/**
 * Fetch and parse an iCal URL, returning reservation-like objects
 */
async function fetchAndParseICal(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch iCal: ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  const events = parseICS(text);

  return events.map(event => ({
    external_uid: event.uid || null,
    guest_name: extractGuestName(event.summary || ''),
    check_in: event.start,
    check_out: event.end,
    status: mapICalStatus(event.status),
    source: 'ical',
    summary: event.summary || '',
    description: event.description || '',
  }));
}

function extractGuestName(summary) {
  // Airbnb format: "Guest Name" or "Reserved - Guest Name" or "Not available"
  if (!summary || summary.toLowerCase().includes('not available') || summary.toLowerCase().includes('blocked')) {
    return 'Blocked';
  }
  // Remove common prefixes
  let name = summary
    .replace(/^reserved\s*[-–—]\s*/i, '')
    .replace(/^booked\s*[-–—]\s*/i, '')
    .replace(/^airbnb\s*[-–—]\s*/i, '')
    .trim();
  return name || 'Guest';
}

function mapICalStatus(icalStatus) {
  if (!icalStatus) return 'confirmed';
  switch (icalStatus.toUpperCase()) {
    case 'CONFIRMED': return 'confirmed';
    case 'TENTATIVE': return 'pending';
    case 'CANCELLED': return 'cancelled';
    default: return 'confirmed';
  }
}

/**
 * Sync iCal data into the database for a property
 */
function syncICalToDatabase(db, propertyId, icalReservations) {
  const inserted = [];
  const updated = [];
  const skipped = [];

  const findByUid = db.prepare(
    'SELECT id FROM reservations WHERE property_id = ? AND external_uid = ?'
  );
  const insertReservation = db.prepare(`
    INSERT INTO reservations (property_id, guest_name, guest_email, check_in, check_out, status, total_price, guests_count, source, external_uid)
    VALUES (?, ?, '', ?, ?, ?, 0, 1, 'ical', ?)
  `);
  const updateReservation = db.prepare(`
    UPDATE reservations SET guest_name = ?, check_in = ?, check_out = ?, status = ?
    WHERE property_id = ? AND external_uid = ?
  `);

  for (const r of icalReservations) {
    if (!r.check_in || !r.check_out) {
      skipped.push(r);
      continue;
    }
    // Skip "blocked" entries — those are just calendar blocks
    if (r.guest_name === 'Blocked') {
      // Mark calendar dates as unavailable instead
      markCalendarUnavailable(db, propertyId, r.check_in, r.check_out);
      skipped.push(r);
      continue;
    }

    if (r.external_uid) {
      const existing = findByUid.get(propertyId, r.external_uid);
      if (existing) {
        updateReservation.run(r.guest_name, r.check_in, r.check_out, r.status, propertyId, r.external_uid);
        updated.push(r);
        continue;
      }
    }

    insertReservation.run(propertyId, r.guest_name, r.check_in, r.check_out, r.status, r.external_uid);
    inserted.push(r);
  }

  return { inserted: inserted.length, updated: updated.length, skipped: skipped.length };
}

function markCalendarUnavailable(db, propertyId, startDate, endDate) {
  const upsert = db.prepare(`
    INSERT INTO calendar (property_id, date, available, price, min_nights)
    VALUES (?, ?, 0, 0, 1)
    ON CONFLICT(property_id, date) DO UPDATE SET available = 0
  `);

  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    upsert.run(propertyId, d.toISOString().split('T')[0]);
  }
}

/**
 * Generate iCal export for a property
 */
function generateICalExport(db, propertyId, propertyName) {
  const reservations = db.prepare(
    "SELECT * FROM reservations WHERE property_id = ? AND status != 'cancelled' ORDER BY check_in"
  ).all(propertyId);

  const blockedDays = db.prepare(
    'SELECT date FROM calendar WHERE property_id = ? AND available = 0'
  ).all(propertyId);

  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//Airbnb Manager//${propertyName}//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${propertyName}`,
  ];

  for (const r of reservations) {
    const uid = r.external_uid || `res-${r.id}@airbnbmanager`;
    ics.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART;VALUE=DATE:${r.check_in.replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${r.check_out.replace(/-/g, '')}`,
      `SUMMARY:${escapeICS(r.guest_name)}`,
      `DESCRIPTION:${escapeICS(`Guests: ${r.guests_count}, Status: ${r.status}`)}`,
      'STATUS:CONFIRMED',
      'END:VEVENT'
    );
  }

  // Add blocked dates as separate events
  let blockStart = null;
  let blockEnd = null;
  const dates = blockedDays.map(d => d.date).sort();

  for (let i = 0; i < dates.length; i++) {
    if (!blockStart) {
      blockStart = dates[i];
      blockEnd = dates[i];
    } else {
      const prev = new Date(blockEnd);
      prev.setDate(prev.getDate() + 1);
      if (prev.toISOString().split('T')[0] === dates[i]) {
        blockEnd = dates[i];
      } else {
        // Emit block
        ics.push(
          'BEGIN:VEVENT',
          `UID:block-${blockStart}@airbnbmanager`,
          `DTSTART;VALUE=DATE:${blockStart.replace(/-/g, '')}`,
          `DTEND;VALUE=DATE:${nextDay(blockEnd).replace(/-/g, '')}`,
          'SUMMARY:Not available',
          'STATUS:CONFIRMED',
          'END:VEVENT'
        );
        blockStart = dates[i];
        blockEnd = dates[i];
      }
    }
  }
  if (blockStart) {
    ics.push(
      'BEGIN:VEVENT',
      `UID:block-${blockStart}@airbnbmanager`,
      `DTSTART;VALUE=DATE:${blockStart.replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${nextDay(blockEnd).replace(/-/g, '')}`,
      'SUMMARY:Not available',
      'STATUS:CONFIRMED',
      'END:VEVENT'
    );
  }

  ics.push('END:VCALENDAR');
  return ics.join('\r\n');
}

function escapeICS(text) {
  return (text || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function nextDay(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

module.exports = { parseICS, fetchAndParseICal, syncICalToDatabase, generateICalExport };
