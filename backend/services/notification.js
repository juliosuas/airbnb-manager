// Webhook-ready notification system
// Placeholder for WhatsApp integration via Jeffrey

async function sendNotification(type, data) {
  const webhookUrl = process.env.NOTIFICATION_WEBHOOK_URL;

  const payload = {
    type,
    timestamp: new Date().toISOString(),
    data,
  };

  console.log(`[Notification] ${type}:`, JSON.stringify(data, null, 2));

  if (!webhookUrl) {
    console.log('[Notification] No webhook URL configured — skipping delivery');
    return { sent: false, reason: 'no_webhook_url' };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return { sent: true, status: response.status };
  } catch (error) {
    console.error('[Notification] Delivery failed:', error.message);
    return { sent: false, reason: error.message };
  }
}

// Notification types
const notify = {
  newReservation: (reservation) =>
    sendNotification('new_reservation', {
      message: `New reservation from ${reservation.guest_name} (${reservation.check_in} → ${reservation.check_out})`,
      reservation,
    }),

  newMessage: (message, guestName) =>
    sendNotification('new_message', {
      message: `New message from ${guestName}: ${message.content.substring(0, 100)}`,
      ...message,
    }),

  checkInReminder: (reservation) =>
    sendNotification('check_in_reminder', {
      message: `Check-in today: ${reservation.guest_name} (${reservation.guests_count} guests)`,
      reservation,
    }),

  checkOutReminder: (reservation) =>
    sendNotification('check_out_reminder', {
      message: `Check-out today: ${reservation.guest_name}`,
      reservation,
    }),

  cleaningDue: (task) =>
    sendNotification('cleaning_due', {
      message: `Cleaning scheduled for ${task.scheduled_date}`,
      task,
    }),

  reviewReceived: (review, guestName) =>
    sendNotification('review_received', {
      message: `New ${review.rating}★ review from ${guestName}`,
      review,
    }),
};

module.exports = { sendNotification, notify };
