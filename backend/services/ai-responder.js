const templates = {
  booking_inquiry: {
    keywords: ['book', 'available', 'availability', 'reserve', 'dates', 'price', 'cost', 'rate', 'how much'],
    response: (guest, reservation) =>
      `Hi ${guest}! Thanks for your interest in Casa Sol. ` +
      (reservation
        ? `Your reservation from ${reservation.check_in} to ${reservation.check_out} is ${reservation.status}. Total: $${reservation.total_price} MXN.`
        : `I'd be happy to check availability for your dates. Could you let me know when you'd like to visit?`),
  },

  check_in: {
    keywords: ['check in', 'check-in', 'checkin', 'arrive', 'arrival', 'door', 'code', 'key', 'access', 'enter'],
    response: (guest) =>
      `Welcome ${guest}! Check-in is at 3:00 PM. Here are your self check-in instructions:\n\n` +
      `1. Go to Calle 38 Norte — look for the building with the blue door\n` +
      `2. The lockbox is on the left side of the door\n` +
      `3. Code: I'll send it 30 minutes before check-in\n` +
      `4. Your apartment is on the 2nd floor, door on the right\n\n` +
      `Let me know when you arrive!`,
  },

  wifi: {
    keywords: ['wifi', 'wi-fi', 'internet', 'password', 'network', 'connection'],
    response: (guest) =>
      `Hi ${guest}! Here's the WiFi info:\n\n` +
      `Network: CasaSol_5G\nPassword: PlayaBeach2026\n\n` +
      `Speed is 200Mbps — great for video calls and streaming. If you have any connection issues, try restarting the router (white box on the bookshelf).`,
  },

  amenities: {
    keywords: ['amenity', 'amenities', 'pool', 'kitchen', 'towel', 'parking', 'laundry', 'washer', 'dryer', 'coffee', 'ac', 'air conditioning'],
    response: (guest) =>
      `Hi ${guest}! Here's what's available:\n\n` +
      `🏊 Rooftop pool: Open 8am-10pm\n` +
      `🅿️ Parking: 1 spot included\n` +
      `🍳 Kitchen: Fully equipped (pots, pans, blender, coffee maker)\n` +
      `🧺 Washer: In-unit, detergent provided\n` +
      `❄️ A/C: Remote is on the nightstand\n` +
      `🏖️ Beach towels: In the hallway closet\n\n` +
      `Need anything else?`,
  },

  checkout: {
    keywords: ['check out', 'check-out', 'checkout', 'leave', 'leaving', 'departure', 'depart'],
    response: (guest) =>
      `Hi ${guest}! Checkout is at 11:00 AM. Before you go:\n\n` +
      `1. Leave used towels in the bathroom\n` +
      `2. Take out any trash to the bin outside\n` +
      `3. Lock the door — it auto-locks when closed\n` +
      `4. Leave the key in the lockbox\n\n` +
      `No need to do dishes or strip the beds — our cleaning team handles that. Safe travels! 🌴`,
  },

  emergency: {
    keywords: ['emergency', 'help', 'urgent', 'broken', 'leak', 'flood', 'fire', 'locked out', 'police', 'hospital', 'doctor'],
    response: (guest) =>
      `Hi ${guest}, I'm sorry you're having an issue. Here's what to do:\n\n` +
      `🚨 Life-threatening emergency: Call 911\n` +
      `🏥 Hospital: Hospiten Playa del Carmen (+52 984 803 1002)\n` +
      `🔧 Maintenance issue: I'll send someone ASAP\n` +
      `🔑 Locked out: Call me directly\n\n` +
      `Can you describe what's happening so I can help?`,
  },

  restaurants: {
    keywords: ['restaurant', 'food', 'eat', 'dinner', 'lunch', 'breakfast', 'recommend', 'suggestion', 'where to'],
    response: (guest) =>
      `Great question ${guest}! Here are my top picks near Casa Sol:\n\n` +
      `🌮 Mexican: La Perla (5th Ave, 2 min walk)\n` +
      `🐟 Seafood: El Fogón (10th Ave, 5 min walk)\n` +
      `🍕 Italian: Ah Cacao (5th Ave, great coffee too)\n` +
      `🥑 Healthy: Chez Celine (French bakery, amazing breakfast)\n\n` +
      `For groceries, there's a Chedraui supermarket 3 blocks away.`,
  },

  default: {
    keywords: [],
    response: (guest) =>
      `Hi ${guest}! Thanks for your message. I'll get back to you shortly. ` +
      `In the meantime, feel free to check the house manual in the apartment for quick answers.`,
  },
};

function matchTemplate(messageContent) {
  const lower = messageContent.toLowerCase();
  let bestMatch = null;
  let bestScore = 0;

  for (const [key, template] of Object.entries(templates)) {
    if (key === 'default') continue;
    const score = template.keywords.filter((kw) => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = key;
    }
  }

  return bestScore > 0 ? bestMatch : 'default';
}

function generateResponse(messageContent, guestName, reservation) {
  const templateKey = matchTemplate(messageContent);
  const template = templates[templateKey];
  return {
    templateKey,
    response: template.response(guestName || 'there', reservation),
  };
}

function getSuggestedResponses(messageContent, guestName, reservation) {
  const primary = generateResponse(messageContent, guestName, reservation);

  // Also suggest the default if primary isn't default
  const suggestions = [primary];
  if (primary.templateKey !== 'default') {
    suggestions.push({
      templateKey: 'default',
      response: templates.default.response(guestName || 'there', reservation),
    });
  }

  return suggestions;
}

module.exports = { generateResponse, getSuggestedResponses, matchTemplate };
