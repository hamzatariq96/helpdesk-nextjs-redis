.PHONY: up down test logs

up:    ## Build, migrate, seed and start on http://localhost:3000
	docker compose up --build -d
	@echo "Open http://localhost:3000  (admin@helpdesk.test / helpdesk123)"

down:  ## Stop and delete the database volume
	docker compose down -v

test:  ## Unit + integration tests against real PostgreSQL and Redis
	docker compose --profile test run --rm --build tests

logs:
	docker compose logs -f app
