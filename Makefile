.PHONY: install seed start dev clean

install:
	cd backend && npm install

seed: install
	cd backend && node db/seed.js

start: seed
	cd backend && node server.js

dev: seed
	cd backend && node --watch server.js

bridge:
	cd ai && pip install -r requirements.txt && python bridge.py

clean:
	rm -f backend/db/airbnb.db

test:
	curl -s http://localhost:3001/api/health | python3 -m json.tool
