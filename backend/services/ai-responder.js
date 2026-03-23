// Template-based AI response generator
// Templates use property data instead of hardcoded "Casa Sol" details

function buildTemplates(property) {
  const name = property ? property.name : 'your property';
  const amenities = property && property.amenities
    ? (typeof property.amenities === 'string' ? JSON.parse(property.amenities) : property.amenities)
    : [];

  return {
    booking_inquiry: {
      keywords: ['book', 'available', 'availability', 'reserve', 'dates', 'price', 'cost', 'rate', 'how much'],
      response: (guest, reservation) =>
        `Hi ${guest}! Thanks for your interest in ${name}. ` +
        (reservation
          ? `Your reservation from ${reservation.check_in} to ${reservation.check_out} is ${reservation.status}. Total: $${reservation.total_price} MXN.`
          : `I'd be happy to check availability for your dates. Could you let me know when you'd like to visit?`),
    },

    check_in: {
      keywords: ['check in', 'check-in', 'checkin', 'arrive', 'arrival', 'door', 'code', 'key', 'access', 'enter'],
      response: (guest) =>
        `Welcome ${guest}! Check-in is at 3:00 PM. Here are your self check-in instructions:\n\n` +
        `1. I'll send the lockbox code 30 minutes before check-in\n` +
        `2. Follow the instructions to access the property\n\n` +
        `Let me know when you arrive!`,
    },

    wifi: {
      keywords: ['wifi', 'wi-fi', 'internet', 'password', 'network', 'connection'],
      response: (guest) =>
        `Hi ${guest}! The WiFi details are in the welcome guide at the property. ` +
        (amenities.some(a => /wifi/i.test(a))
          ? `We have high-speed internet — great for video calls and streaming. `
          : '') +
        `If you have any connection issues, let me know and I'll help troubleshoot.`,
    },

    amenities: {
      keywords: ['amenity', 'amenities', 'pool', 'kitchen', 'towel', 'parking', 'laundry', 'washer', 'dryer', 'coffee', 'ac', 'air conditioning'],
      response: (guest) => {
        let text = `Hi ${guest}! Here's what's available at ${name}:\n\n`;
        if (amenities.length > 0) {
          text += amenities.map(a => `- ${a}`).join('\n');
        } else {
          text += 'Please check the property listing for the full list of amenities.';
        }
        text += '\n\nNeed anything else?';
        return text;
      },
    },

    checkout: {
      keywords: ['check out', 'check-out', 'checkout', 'leave', 'leaving', 'departure', 'depart'],
      response: (guest) =>
        `Hi ${guest}! Checkout is at 11:00 AM. Before you go:\n\n` +
        `1. Leave used towels in the bathroom\n` +
        `2. Take out any trash to the bin outside\n` +
        `3. Lock the door when you leave\n\n` +
        `No need to do dishes or strip the beds — our cleaning team handles that. Safe travels!`,
    },

    emergency: {
      keywords: ['emergency', 'help', 'urgent', 'broken', 'leak', 'flood', 'fire', 'locked out', 'police', 'hospital', 'doctor'],
      response: (guest) =>
        `Hi ${guest}, I'm sorry you're having an issue. Here's what to do:\n\n` +
        `- Life-threatening emergency: Call 911\n` +
        `- Maintenance issue: I'll send someone ASAP\n` +
        `- Locked out: Call me directly\n\n` +
        `Can you describe what's happening so I can help?`,
    },

    restaurants: {
      keywords: ['restaurant', 'food', 'eat', 'dinner', 'lunch', 'breakfast', 'recommend', 'suggestion', 'where to'],
      response: (guest) =>
        `Great question ${guest}! I'd recommend checking with locals or Google Maps for the best nearby options. ` +
        `I'm happy to share my personal favorites if you let me know what type of cuisine you're looking for!`,
    },

    default: {
      keywords: [],
      response: (guest) =>
        `Hi ${guest}! Thanks for your message. I'll get back to you shortly. ` +
        `In the meantime, feel free to check the house manual in the property for quick answers.`,
    },
  };
}

function matchTemplate(messageContent, templates) {
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

function generateResponse(messageContent, guestName, reservation, property) {
  const templates = buildTemplates(property);
  const templateKey = matchTemplate(messageContent, templates);
  const template = templates[templateKey];
  return {
    templateKey,
    response: template.response(guestName || 'there', reservation),
  };
}

function getSuggestedResponses(messageContent, guestName, reservation, property) {
  const templates = buildTemplates(property);
  const primary = generateResponse(messageContent, guestName, reservation, property);

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
