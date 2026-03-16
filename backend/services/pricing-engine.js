const MEXICAN_HOLIDAYS = [
  { month: 1, day: 1, name: 'Año Nuevo' },
  { month: 2, day: 5, name: 'Día de la Constitución' },
  { month: 3, day: 21, name: 'Natalicio de Benito Juárez' },
  { month: 5, day: 1, name: 'Día del Trabajo' },
  { month: 9, day: 16, name: 'Día de la Independencia' },
  { month: 11, day: 20, name: 'Revolución Mexicana' },
  { month: 12, day: 25, name: 'Navidad' },
];

// High season: Dec-Mar (winter), Jul-Aug (summer)
const HIGH_SEASON_MONTHS = [12, 1, 2, 3, 7, 8];

function isHoliday(date) {
  const d = new Date(date);
  return MEXICAN_HOLIDAYS.find(
    (h) => h.month === d.getMonth() + 1 && h.day === d.getDate()
  );
}

function isWeekend(date) {
  const day = new Date(date).getDay();
  return day === 5 || day === 6; // Friday, Saturday
}

function isHighSeason(date) {
  const month = new Date(date).getMonth() + 1;
  return HIGH_SEASON_MONTHS.includes(month);
}

function daysUntil(date) {
  const now = new Date();
  const target = new Date(date);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function calculatePrice(date, options = {}) {
  const basePrice = options.basePrice || parseFloat(process.env.BASE_PRICE) || 1500;
  const weekendMultiplier = options.weekendMultiplier || parseFloat(process.env.WEEKEND_MULTIPLIER) || 1.3;

  let price = basePrice;
  const factors = [];

  // Weekend adjustment
  if (isWeekend(date)) {
    price *= weekendMultiplier;
    factors.push({ name: 'weekend', multiplier: weekendMultiplier });
  }

  // Seasonal adjustment
  if (isHighSeason(date)) {
    const seasonMultiplier = 1.25;
    price *= seasonMultiplier;
    factors.push({ name: 'high_season', multiplier: seasonMultiplier });
  }

  // Holiday premium
  const holiday = isHoliday(date);
  if (holiday) {
    const holidayMultiplier = 1.5;
    price *= holidayMultiplier;
    factors.push({ name: `holiday_${holiday.name}`, multiplier: holidayMultiplier });
  }

  // Last-minute discount (< 3 days out, no bookings)
  const daysOut = daysUntil(date);
  if (daysOut >= 0 && daysOut <= 3 && !options.isBooked) {
    const discountMultiplier = 0.85;
    price *= discountMultiplier;
    factors.push({ name: 'last_minute_discount', multiplier: discountMultiplier });
  }

  // Long stay discount
  if (options.stayLength && options.stayLength >= 7) {
    const longStayMultiplier = options.stayLength >= 28 ? 0.75 : 0.9;
    price *= longStayMultiplier;
    factors.push({ name: 'long_stay_discount', multiplier: longStayMultiplier });
  }

  // Demand factor (0.8 to 1.2 based on occupancy)
  if (options.occupancyRate !== undefined) {
    const demandMultiplier = 0.8 + (options.occupancyRate * 0.4);
    price *= demandMultiplier;
    factors.push({ name: 'demand', multiplier: Math.round(demandMultiplier * 100) / 100 });
  }

  return {
    date,
    basePrice,
    finalPrice: Math.round(price / 50) * 50, // Round to nearest 50 MXN
    factors,
    currency: process.env.CURRENCY || 'MXN',
  };
}

function calculateRangePrice(startDate, endDate, options = {}) {
  const prices = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const stayLength = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    prices.push(calculatePrice(dateStr, { ...options, stayLength }));
  }

  const total = prices.reduce((sum, p) => sum + p.finalPrice, 0);
  const avg = Math.round(total / prices.length);

  return { prices, total, average: avg, nights: stayLength, currency: process.env.CURRENCY || 'MXN' };
}

module.exports = { calculatePrice, calculateRangePrice, isHoliday, isWeekend, isHighSeason };
