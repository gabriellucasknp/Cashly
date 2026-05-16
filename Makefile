.PHONY: help setup build up dev down down-v logs logs-app logs-ai restart ps clean

help: ## Mostra esta ajuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

setup: ## Cria o arquivo .env a partir do .env.example
	@[ -f .env ] && echo ".env já existe" || (cp .env.example .env && echo ".env criado — edite com suas credenciais")

build: ## Builda as imagens Docker
	docker compose build

up: ## Sobe todos os serviços em background
	docker compose up -d

dev: ## Sobe com logs em tempo real
	docker compose up

down: ## Para todos os serviços
	docker compose down

down-v: ## Para todos os serviços e remove volumes (APAGA DADOS)
	docker compose down -v

logs: ## Exibe logs de todos os serviços
	docker compose logs -f

logs-app: ## Exibe logs apenas do backend Spring Boot
	docker compose logs -f app

logs-ai: ## Exibe logs apenas do AI Agent
	docker compose logs -f ai-agent

restart: ## Reinicia todos os serviços
	docker compose restart

ps: ## Lista serviços em execução
	docker compose ps

clean: ## Remove imagens e volumes não utilizados
	docker system prune -f
