.PHONY: install seed start dev clean docker

install:
	cd backend && npm install

seed: install
	cd backend && node db/seed.js

start: seed
	cd backend && node server.js

dev: seed
	cd backend && node --watch server.js

clean:
	rm -f backend/db/airbnb.db

docker:
	docker compose up --build

test:
	curl -s http://localhost:3001/api/health | python3 -m json.tool
