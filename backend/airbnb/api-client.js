// Airbnb API client — placeholder with interface ready for real API
// Uses airbnb-host-api (Python) via child_process bridge when available

const { execFile } = require('child_process');
const path = require('path');

const PYTHON_BRIDGE = path.join(__dirname, '..', '..', 'ai', 'bridge.py');

class AirbnbClient {
  constructor(options = {}) {
    this.email = options.email || process.env.AIRBNB_EMAIL;
    this.password = options.password || process.env.AIRBNB_PASSWORD;
    this.authenticated = false;
    this.usePythonBridge = options.usePythonBridge || false;
  }

  async _callBridge(endpoint, data = {}) {
    if (!this.usePythonBridge) {
      return { error: 'Python bridge not enabled', mock: true };
    }

    return new Promise((resolve, reject) => {
      const url = `http://localhost:5001${endpoint}`;
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
        .then((r) => r.json())
        .then(resolve)
        .catch(reject);
    });
  }

  async login() {
    if (!this.email || !this.password) {
      console.log('[AirbnbClient] No credentials — running in mock mode');
      return { success: false, mock: true, message: 'No credentials configured' };
    }

    try {
      const result = await this._callBridge('/airbnb/login', {
        email: this.email,
        password: this.password,
      });
      this.authenticated = result.success;
      return result;
    } catch (error) {
      console.log('[AirbnbClient] Bridge not available — running in mock mode');
      return { success: false, mock: true, message: error.message };
    }
  }

  async getReservations() {
    if (!this.authenticated) {
      return { mock: true, data: [], message: 'Not authenticated — use local database' };
    }
    return this._callBridge('/airbnb/reservations');
  }

  async getCalendar(months = 3) {
    if (!this.authenticated) {
      return { mock: true, data: [], message: 'Not authenticated — use local database' };
    }
    return this._callBridge('/airbnb/calendar', { months });
  }

  async sendMessage(reservationId, message) {
    if (!this.authenticated) {
      return { mock: true, sent: false, message: 'Not authenticated — message saved locally only' };
    }
    return this._callBridge('/airbnb/message', { reservationId, message });
  }

  async updatePricing(dates) {
    if (!this.authenticated) {
      return { mock: true, updated: false, message: 'Not authenticated — pricing saved locally only' };
    }
    return this._callBridge('/airbnb/pricing', { dates });
  }
}

module.exports = AirbnbClient;
