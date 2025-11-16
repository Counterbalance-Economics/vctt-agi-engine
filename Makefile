
.PHONY: help install dev test clean docker-up docker-down migrate seed

help:
	@echo "VCTT-AGI Engine - Makefile Commands"
	@echo ""
	@echo "  make install     - Install dependencies"
	@echo "  make dev         - Run development server locally"
	@echo "  make test        - Run tests"
	@echo "  make clean       - Clean temporary files"
	@echo "  make docker-up   - Start Docker Compose services"
	@echo "  make docker-down - Stop Docker Compose services"
	@echo "  make migrate     - Run database migrations"
	@echo "  make seed        - Seed database with sample data"

install:
	pip install -r requirements.txt

dev:
	uvicorn vctt_agi.api.main:app --reload --host 0.0.0.0 --port 8000

test:
	pytest tests/ -v

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	rm -rf .pytest_cache htmlcov .coverage

docker-up:
	docker-compose up --build

docker-down:
	docker-compose down

migrate:
	alembic upgrade head

seed:
	python scripts/seed_data.py
