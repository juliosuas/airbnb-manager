"""
Flask micro-service that bridges airbnb-host-api (Python) for Node.js to call.
Start with: python bridge.py
"""

from flask import Flask, request, jsonify
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))

app = Flask(__name__)

# Placeholder: will import airbnb_host_api when available
# from airbnb_host_api import AirbnbHost

airbnb_client = None


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'airbnb-bridge'})


@app.route('/airbnb/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'success': False, 'error': 'Credentials required'}), 400

    # Placeholder for real authentication
    # global airbnb_client
    # airbnb_client = AirbnbHost(email, password)
    # airbnb_client.login()

    return jsonify({
        'success': False,
        'mock': True,
        'message': 'airbnb-host-api not yet configured — using mock mode'
    })


@app.route('/airbnb/reservations', methods=['POST'])
def get_reservations():
    # Placeholder: return from Airbnb API
    return jsonify({'mock': True, 'data': [], 'message': 'Use local database'})


@app.route('/airbnb/calendar', methods=['POST'])
def get_calendar():
    return jsonify({'mock': True, 'data': [], 'message': 'Use local database'})


@app.route('/airbnb/message', methods=['POST'])
def send_message():
    data = request.json
    return jsonify({
        'mock': True,
        'sent': False,
        'message': f'Message not sent via Airbnb (mock mode): {data.get("message", "")[:50]}'
    })


@app.route('/airbnb/pricing', methods=['POST'])
def update_pricing():
    return jsonify({'mock': True, 'updated': False, 'message': 'Pricing not synced to Airbnb (mock mode)'})


if __name__ == '__main__':
    port = int(os.environ.get('BRIDGE_PORT', 5001))
    print(f'\n  🐍 Airbnb Bridge running at http://localhost:{port}\n')
    app.run(port=port, debug=True)
