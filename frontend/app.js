const API = 'http://localhost:3001/api';

// State
let currentSection = 'dashboard';
let calendarMonth = new Date().getMonth();
let calendarYear = new Date().getFullYear();
let selectedReservationId = null;
let allReservations = [];

// --- Navigation ---
document.querySelectorAll('.nav-links li').forEach(li => {
  li.addEventListener('click', () => {
    document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
    li.classList.add('active');
    const section = li.dataset.section;
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(section).classList.add('active');
    currentSection = section;
    loadSection(section);
  });
});

// --- API Helpers ---
async function api(endpoint, options = {}) {
  try {
    const res = await fetch(`${API}${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    return await res.json();
  } catch (e) {
    console.error('API Error:', e);
    return null;
  }
}

// --- Load Sections ---
function loadSection(section) {
  switch (section) {
    case 'dashboard': loadDashboard(); break;
    case 'calendar': loadCalendar(); break;
    case 'messages': loadMessages(); break;
    case 'reservations': loadReservations(); break;
    case 'pricing': break;
    case 'cleaning': loadCleaning(); break;
    case 'reviews': loadReviews(); break;
  }
}

// --- Dashboard ---
async function loadDashboard() {
  const [analytics, property, reservations, messages, cleaning] = await Promise.all([
    api('/analytics'),
    api('/property'),
    api('/reservations?upcoming=true'),
    api('/messages?unread=true'),
    api('/cleaning'),
  ]);

  if (analytics) {
    document.getElementById('stat-occupancy').textContent = `${analytics.occupancy_rate}%`;
    document.getElementById('stat-revenue').textContent = `$${(analytics.monthly_revenue || 0).toLocaleString()} MXN`;
    document.getElementById('stat-rating').textContent = `${analytics.average_rating} ⭐`;
    document.getElementById('stat-pending').textContent = analytics.pending_messages;

    const badge = document.getElementById('msg-badge');
    badge.textContent = analytics.pending_messages > 0 ? analytics.pending_messages : '';
  }

  if (property) {
    const amenities = (property.amenities || []).map(a => `<span class="amenity-tag">${a}</span>`).join('');
    document.getElementById('property-info').innerHTML = `
      <div class="property-detail"><strong>Name</strong>${property.name}</div>
      <div class="property-detail"><strong>Address</strong>${property.address}</div>
      <div class="property-detail"><strong>Capacity</strong>${property.bedrooms} bed · ${property.bathrooms} bath · ${property.max_guests} guests</div>
      <div class="property-detail"><strong>Amenities</strong>${amenities}</div>
    `;
  }

  if (reservations) {
    const upcoming = reservations.filter(r => r.status === 'confirmed').slice(0, 5);
    document.getElementById('upcoming-checkins').innerHTML = upcoming.length
      ? upcoming.map(r => `
        <div class="checkin-item">
          <strong>${r.guest_name}</strong>
          <div class="item-sub">${formatDate(r.check_in)} → ${formatDate(r.check_out)} · ${r.guests_count} guests</div>
        </div>
      `).join('')
      : '<div class="item-sub">No upcoming check-ins</div>';
  }

  if (messages) {
    const recent = messages.slice(0, 5);
    document.getElementById('recent-messages').innerHTML = recent.length
      ? recent.map(m => `
        <div class="msg-item">
          <strong>${m.guest_name || 'Guest'}</strong>
          <div class="item-sub">${m.content.substring(0, 80)}...</div>
        </div>
      `).join('')
      : '<div class="item-sub">No unread messages</div>';
  }

  if (cleaning) {
    const pending = cleaning.filter(t => t.status === 'pending').slice(0, 4);
    document.getElementById('cleaning-overview').innerHTML = pending.length
      ? pending.map(t => `
        <div class="clean-item">
          <strong>${formatDate(t.scheduled_date)}</strong>
          <div class="item-sub">After ${t.guest_name}'s checkout</div>
        </div>
      `).join('')
      : '<div class="item-sub">No pending tasks</div>';
  }
}

// --- Calendar ---
async function loadCalendar() {
  const label = document.getElementById('cal-month-label');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  label.textContent = `${months[calendarMonth]} ${calendarYear}`;

  const data = await api(`/calendar?month=${calendarMonth + 1}&year=${calendarYear}`);
  const grid = document.getElementById('calendar-grid');

  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let html = dayNames.map(d => `<div class="cal-header">${d}</div>`).join('');

  const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  for (let i = 0; i < firstDay; i++) {
    html += '<div class="cal-day empty"></div>';
  }

  const calMap = {};
  if (data) data.forEach(d => calMap[d.date] = d);

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cal = calMap[dateStr];
    const isToday = dateStr === today;
    const isBooked = cal && !cal.available;

    let cls = 'cal-day';
    if (isToday) cls += ' today';
    else if (isBooked) cls += ' booked';
    else if (cal) cls += ' available';

    html += `
      <div class="${cls}">
        <div class="cal-day-num">${day}</div>
        ${cal ? `<div class="cal-day-price">$${cal.price}</div>` : ''}
        ${isBooked ? '<div style="font-size:0.65rem;color:var(--accent-light)">Booked</div>' : ''}
      </div>
    `;
  }

  grid.innerHTML = html;
}

document.getElementById('cal-prev').addEventListener('click', () => {
  calendarMonth--;
  if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
  loadCalendar();
});

document.getElementById('cal-next').addEventListener('click', () => {
  calendarMonth++;
  if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
  loadCalendar();
});

// --- Messages ---
async function loadMessages() {
  const messages = await api('/messages');
  if (!messages) return;

  // Group by reservation
  const convos = {};
  messages.forEach(m => {
    if (!m.reservation_id) return;
    if (!convos[m.reservation_id]) {
      convos[m.reservation_id] = { guest_name: m.guest_name, messages: [], hasUnread: false };
    }
    convos[m.reservation_id].messages.push(m);
    if (!m.is_read && m.sender === 'guest') convos[m.reservation_id].hasUnread = true;
  });

  const list = document.getElementById('conversations-list');
  list.innerHTML = Object.entries(convos).map(([resId, c]) => {
    const lastMsg = c.messages[0];
    return `
      <div class="convo-item ${c.hasUnread ? 'convo-unread' : ''}" data-res-id="${resId}">
        <div class="convo-name">${c.guest_name || 'Guest'}</div>
        <div class="convo-preview">${lastMsg.content.substring(0, 50)}</div>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.convo-item').forEach(item => {
    item.addEventListener('click', () => openConversation(item.dataset.resId, convos));
  });
}

function openConversation(resId, convos) {
  selectedReservationId = resId;
  const convo = convos[resId];

  document.querySelectorAll('.convo-item').forEach(i => i.classList.remove('active'));
  document.querySelector(`.convo-item[data-res-id="${resId}"]`)?.classList.add('active');

  document.getElementById('chat-header').textContent = convo.guest_name;
  document.getElementById('chat-input-area').style.display = 'block';
  document.getElementById('ai-suggestions').innerHTML = '';

  const chat = document.getElementById('chat-messages');
  const sorted = [...convo.messages].reverse();
  chat.innerHTML = sorted.map(m => `
    <div class="msg-bubble ${m.sender === 'guest' ? 'msg-guest' : (m.is_ai_response ? 'msg-ai' : 'msg-host')}">
      ${m.content}
      <div class="msg-time">${new Date(m.timestamp).toLocaleString()}</div>
    </div>
  `).join('');
  chat.scrollTop = chat.scrollHeight;
}

// Send message
document.getElementById('chat-send').addEventListener('click', sendMessage);
document.getElementById('chat-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const content = input.value.trim();
  if (!content || !selectedReservationId) return;

  input.value = '';
  const result = await api('/messages/send', {
    method: 'POST',
    body: JSON.stringify({ reservation_id: selectedReservationId, content }),
  });

  if (result) {
    loadMessages();
  }
}

// AI suggest
document.getElementById('chat-ai').addEventListener('click', async () => {
  if (!selectedReservationId) return;

  const msgs = await api(`/messages?reservation_id=${selectedReservationId}`);
  if (!msgs || !msgs.length) return;

  const lastGuestMsg = msgs.find(m => m.sender === 'guest');
  if (!lastGuestMsg) return;

  const result = await api('/messages/suggest', {
    method: 'POST',
    body: JSON.stringify({ reservation_id: selectedReservationId, message_content: lastGuestMsg.content }),
  });

  if (result && result.suggestions) {
    const container = document.getElementById('ai-suggestions');
    container.innerHTML = result.suggestions.map(s => `
      <div class="ai-suggestion" data-content="${encodeURIComponent(s.response)}">
        <div class="ai-suggestion-label">🤖 AI: ${s.templateKey}</div>
        ${s.response.substring(0, 120)}...
      </div>
    `).join('');

    container.querySelectorAll('.ai-suggestion').forEach(el => {
      el.addEventListener('click', async () => {
        const content = decodeURIComponent(el.dataset.content);
        await api('/messages/send', {
          method: 'POST',
          body: JSON.stringify({ reservation_id: selectedReservationId, content, use_ai: false }),
        });
        container.innerHTML = '';
        loadMessages();
      });
    });
  }
});

// --- Reservations ---
async function loadReservations(filter = 'all') {
  const url = filter === 'all' ? '/reservations' : `/reservations?status=${filter}`;
  const data = await api(url);
  allReservations = data || [];

  const tbody = document.querySelector('#reservations-table tbody');
  tbody.innerHTML = allReservations.map(r => `
    <tr>
      <td><strong>${r.guest_name}</strong><br><span style="color:var(--text-dim);font-size:0.8rem">${r.guest_email}</span></td>
      <td>${formatDate(r.check_in)}</td>
      <td>${formatDate(r.check_out)}</td>
      <td>${r.guests_count}</td>
      <td>$${r.total_price?.toLocaleString()} MXN</td>
      <td><span class="status status-${r.status}">${r.status}</span></td>
    </tr>
  `).join('');
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadReservations(btn.dataset.filter);
  });
});

// --- Pricing ---
document.getElementById('pricing-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const result = await api('/pricing', {
    method: 'POST',
    body: JSON.stringify({
      start_date: document.getElementById('price-start').value,
      end_date: document.getElementById('price-end').value,
      price: parseFloat(document.getElementById('price-value').value) || null,
      min_nights: parseInt(document.getElementById('price-min-nights').value) || null,
    }),
  });
  document.getElementById('pricing-result').innerHTML = result
    ? `<div style="color:var(--green)">Updated ${result.updated} days</div>`
    : '<div style="color:var(--red)">Error updating pricing</div>';
});

document.getElementById('calc-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const start = document.getElementById('calc-start').value;
  const end = document.getElementById('calc-end').value;
  const result = await api(`/pricing/calculate?start_date=${start}&end_date=${end}`);
  if (result) {
    document.getElementById('calc-result').innerHTML = `
      <div style="padding:12px;background:var(--bg);border-radius:8px">
        <div style="font-size:1.4rem;font-weight:700;color:var(--green)">$${result.total.toLocaleString()} ${result.currency}</div>
        <div style="color:var(--text-dim);margin-top:4px">${result.nights} nights · Avg $${result.average}/night</div>
      </div>
    `;
  }
});

// --- Cleaning ---
async function loadCleaning() {
  const tasks = await api('/cleaning');
  if (!tasks) return;

  const tbody = document.querySelector('#cleaning-table tbody');
  tbody.innerHTML = tasks.map(t => `
    <tr>
      <td>${formatDate(t.scheduled_date)}</td>
      <td>${t.guest_name || '—'}</td>
      <td>${t.check_out ? formatDate(t.check_out) : '—'}</td>
      <td><span class="status status-${t.status === 'completed' ? 'completed' : 'pending'}">${t.status}</span></td>
      <td>${t.cleaner_notes || '—'}</td>
      <td>
        ${t.status !== 'completed' ? `<button class="btn btn-sm" onclick="markCleaned(${t.id})">Complete</button>` : '✓'}
      </td>
    </tr>
  `).join('');
}

async function markCleaned(id) {
  await api(`/cleaning/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'completed' }) });
  loadCleaning();
}

// --- Reviews ---
async function loadReviews() {
  const reviews = await api('/reviews');
  if (!reviews) return;

  document.getElementById('reviews-list').innerHTML = reviews.map(r => `
    <div class="review-card">
      <div class="review-header">
        <span class="review-guest">${r.guest_name || 'Guest'}</span>
        <span class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
      </div>
      <div class="review-comment">${r.comment}</div>
      ${r.response ? `<div class="review-response"><strong>Your response:</strong> ${r.response}</div>` : ''}
    </div>
  `).join('');
}

// --- Helpers ---
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// --- Init ---
loadDashboard();
