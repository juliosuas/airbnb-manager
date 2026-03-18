// Mock API data for GitHub Pages demo
const MOCK_DATA = {
  analytics: {
    occupancy_rate: 78,
    monthly_revenue: 45600,
    average_rating: 4.8,
    pending_messages: 3,
    total_reservations: 12
  },
  property: {
    name: "Casa Sol",
    address: "Av. Constituyentes 120, Playa del Carmen, QR 77710",
    bedrooms: 2,
    bathrooms: 2,
    max_guests: 6,
    amenities: ["WiFi", "Pool", "AC", "Kitchen", "Parking", "Beach Access", "Smart TV", "Washer"]
  },
  reservations: [
    { id: 1, guest_name: "Sarah Johnson", guest_email: "sarah@email.com", check_in: "2026-03-20", check_out: "2026-03-25", guests_count: 4, total_price: 18500, status: "confirmed" },
    { id: 2, guest_name: "Marco Rossi", guest_email: "marco@email.com", check_in: "2026-03-26", check_out: "2026-03-30", guests_count: 2, total_price: 14200, status: "confirmed" },
    { id: 3, guest_name: "Emma Wilson", guest_email: "emma@email.com", check_in: "2026-04-02", check_out: "2026-04-07", guests_count: 3, total_price: 16800, status: "pending" },
    { id: 4, guest_name: "Carlos Mendez", guest_email: "carlos@email.com", check_in: "2026-03-10", check_out: "2026-03-15", guests_count: 5, total_price: 22000, status: "completed" },
    { id: 5, guest_name: "Yuki Tanaka", guest_email: "yuki@email.com", check_in: "2026-04-10", check_out: "2026-04-14", guests_count: 2, total_price: 12600, status: "confirmed" },
    { id: 6, guest_name: "Lisa Chen", guest_email: "lisa@email.com", check_in: "2026-03-01", check_out: "2026-03-05", guests_count: 4, total_price: 15400, status: "completed" },
    { id: 7, guest_name: "Ahmed Hassan", guest_email: "ahmed@email.com", check_in: "2026-04-15", check_out: "2026-04-20", guests_count: 6, total_price: 24500, status: "pending" }
  ],
  messages: [
    { id: 1, reservation_id: 1, guest_name: "Sarah Johnson", content: "Hi! We're so excited about our trip. What time is check-in?", sender: "guest", is_read: false, timestamp: "2026-03-18T10:30:00Z" },
    { id: 2, reservation_id: 1, guest_name: "Sarah Johnson", content: "Check-in is at 3:00 PM. I'll send you the access code the day before!", sender: "host", is_read: true, timestamp: "2026-03-18T10:45:00Z", is_ai_response: false },
    { id: 3, reservation_id: 2, guest_name: "Marco Rossi", content: "Is parking available at the property?", sender: "guest", is_read: false, timestamp: "2026-03-18T09:15:00Z" },
    { id: 4, reservation_id: 3, guest_name: "Emma Wilson", content: "Can we bring a small dog? She's very well behaved!", sender: "guest", is_read: false, timestamp: "2026-03-17T16:20:00Z" },
    { id: 5, reservation_id: 2, guest_name: "Marco Rossi", content: "Also, are there good restaurants nearby?", sender: "guest", is_read: true, timestamp: "2026-03-18T09:20:00Z" },
    { id: 6, reservation_id: 4, guest_name: "Carlos Mendez", content: "Thank you for a wonderful stay! The pool was amazing.", sender: "guest", is_read: true, timestamp: "2026-03-15T11:00:00Z" }
  ],
  reviews: [
    { id: 1, guest_name: "Lisa Chen", rating: 5, comment: "Absolutely beautiful property! The pool was perfect and the beach is just steps away. The smart home features were a nice touch. Will definitely come back!", response: "Thank you Lisa! We loved hosting you and your family. You're welcome back anytime! 🌊" },
    { id: 2, guest_name: "Carlos Mendez", rating: 5, comment: "Casa Sol exceeded all expectations. Clean, modern, and the host was incredibly responsive. The AI concierge helped us find the best local restaurants!", response: null },
    { id: 3, guest_name: "Anna Müller", rating: 4, comment: "Great location and amenities. The kitchen was well-equipped for cooking. Only suggestion: more towels for the pool area. Otherwise perfect!", response: "Thanks for the feedback Anna! We've added extra pool towels. Hope to see you again! 🏖️" },
    { id: 4, guest_name: "James Park", rating: 5, comment: "The best Airbnb experience I've had in Mexico. Everything was spotless and the check-in process was seamless.", response: null }
  ],
  cleaning: [
    { id: 1, scheduled_date: "2026-03-25", guest_name: "Sarah Johnson", check_out: "2026-03-25", status: "pending", cleaner_notes: null },
    { id: 2, scheduled_date: "2026-03-30", guest_name: "Marco Rossi", check_out: "2026-03-30", status: "pending", cleaner_notes: null },
    { id: 3, scheduled_date: "2026-03-15", guest_name: "Carlos Mendez", check_out: "2026-03-15", status: "completed", cleaner_notes: "Deep clean done. Pool area spotless." },
    { id: 4, scheduled_date: "2026-04-07", guest_name: "Emma Wilson", check_out: "2026-04-07", status: "pending", cleaner_notes: null }
  ]
};

// Generate calendar data
function generateCalendarData(month, year) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const data = [];
  const bookedRanges = [
    { start: 20, end: 25 }, { start: 26, end: 30 }
  ];
  
  for (let day = 1; day <= daysInMonth; day++) {
    const isBooked = bookedRanges.some(r => day >= r.start && day < r.end);
    const isWeekend = [0, 6].includes(new Date(year, month - 1, day).getDay());
    const basePrice = 3200;
    const price = isWeekend ? Math.round(basePrice * 1.3) : basePrice;
    
    data.push({
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      available: !isBooked,
      price: price
    });
  }
  return data;
}

MOCK_DATA.calendar = generateCalendarData(new Date().getMonth() + 1, new Date().getFullYear());
