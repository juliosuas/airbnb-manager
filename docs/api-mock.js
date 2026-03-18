// Override the API function to use mock data
const originalApi = typeof api !== 'undefined' ? api : null;

async function api(endpoint, options = {}) {
  // Simulate network delay
  await new Promise(r => setTimeout(r, 300 + Math.random() * 400));
  
  if (endpoint === '/analytics') return MOCK_DATA.analytics;
  if (endpoint === '/property') return MOCK_DATA.property;
  if (endpoint.startsWith('/reservations')) {
    const params = new URLSearchParams(endpoint.split('?')[1] || '');
    let res = [...MOCK_DATA.reservations];
    if (params.get('upcoming') === 'true') res = res.filter(r => r.status === 'confirmed');
    if (params.get('status') && params.get('status') !== 'all') res = res.filter(r => r.status === params.get('status'));
    return res;
  }
  if (endpoint.startsWith('/calendar')) {
    const params = new URLSearchParams(endpoint.split('?')[1] || '');
    const month = parseInt(params.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(params.get('year')) || new Date().getFullYear();
    return generateCalendarData(month, year);
  }
  if (endpoint.startsWith('/messages')) {
    const params = new URLSearchParams(endpoint.split('?')[1] || '');
    let msgs = [...MOCK_DATA.messages];
    if (params.get('unread') === 'true') msgs = msgs.filter(m => !m.is_read && m.sender === 'guest');
    if (params.get('reservation_id')) msgs = msgs.filter(m => m.reservation_id === parseInt(params.get('reservation_id')));
    return msgs;
  }
  if (endpoint === '/messages/send') {
    const body = JSON.parse(options.body || '{}');
    return { success: true, id: Date.now() };
  }
  if (endpoint === '/messages/suggest') {
    return {
      suggestions: [
        { templateKey: "Quick Reply", response: "Thank you for your message! I'll get back to you shortly with all the details you need. Looking forward to hosting you at Casa Sol! 🏠" },
        { templateKey: "AI Suggestion", response: "Great question! Yes, we'd be happy to accommodate that. Let me check the details and confirm everything for your stay." }
      ]
    };
  }
  if (endpoint === '/reviews') return MOCK_DATA.reviews;
  if (endpoint === '/cleaning') return MOCK_DATA.cleaning;
  if (endpoint.startsWith('/pricing/calculate')) {
    return { total: 16000, currency: "MXN", nights: 5, average: 3200 };
  }
  if (endpoint === '/pricing') return { updated: 7 };
  
  return null;
}
