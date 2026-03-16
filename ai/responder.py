"""
AI response generator — pluggable with OpenAI or local LLM.
Used for generating more sophisticated guest responses beyond templates.
"""

import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))

SYSTEM_PROMPT = """You are a friendly, professional Airbnb host assistant for "Casa Sol" in Playa del Carmen, Mexico.
Your property is a modern 2-bedroom apartment, 2 blocks from the beach.
Respond in the same language the guest uses. Keep responses warm but concise.
Include relevant details about the property when helpful."""


def generate_ai_response(message, guest_name, context=None):
    """
    Generate an AI response to a guest message.
    Falls back to a simple response if no API key is configured.
    """
    api_key = os.environ.get('OPENAI_API_KEY')

    if not api_key:
        return {
            'response': f'Hi {guest_name}! Thanks for your message. Let me get back to you shortly.',
            'model': 'fallback',
            'note': 'Configure OPENAI_API_KEY for AI-powered responses'
        }

    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)

        messages = [
            {'role': 'system', 'content': SYSTEM_PROMPT},
        ]

        if context:
            messages.append({
                'role': 'system',
                'content': f'Guest: {guest_name}. Check-in: {context.get("check_in")}. Check-out: {context.get("check_out")}. Guests: {context.get("guests_count", 1)}.'
            })

        messages.append({'role': 'user', 'content': message})

        response = client.chat.completions.create(
            model='gpt-4o-mini',
            messages=messages,
            max_tokens=300,
            temperature=0.7,
        )

        return {
            'response': response.choices[0].message.content,
            'model': 'gpt-4o-mini',
            'tokens': response.usage.total_tokens,
        }

    except Exception as e:
        return {
            'response': f'Hi {guest_name}! Thanks for your message. Let me get back to you shortly.',
            'model': 'error_fallback',
            'error': str(e),
        }


if __name__ == '__main__':
    result = generate_ai_response(
        'Hi! What time is check-in?',
        'Pierre',
        {'check_in': '2026-03-14', 'check_out': '2026-03-19', 'guests_count': 4}
    )
    print(result)
