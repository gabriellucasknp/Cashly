# 🐳 Deploy com Docker

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) 24+
- [Docker Compose](https://docs.docker.com/compose/) v2+
- Chave da API Google Gemini → [aistudio.google.com](https://aistudio.google.com/app/apikey)

## Deploy local (rápido)

### 1. Clonar e configurar variáveis de ambiente

```bash
git clone https://github.com/gabriellucasknp/Cashly.git
cd Cashly
cp .env.example .env
```

Edite o `.env` com suas credenciais:

```dotenv
DB_USER=myuser
DB_PASSWORD=SUA_SENHA_FORTE_AQUI  # troque por uma senha forte e única
GEMINI_API_KEY=AIza...             # sua chave do Google Gemini
```

### 2. Build e subir os serviços

```bash
make build   # builda as imagens (pode demorar na primeira vez)
make up      # sobe os 3 serviços em background
```

Ou sem Makefile:

```bash
docker compose build
docker compose up -d
```

### 3. Verificar status

```bash
make ps      # lista serviços
make logs    # acompanha logs em tempo real
```

### 4. Acessar a aplicação

| Serviço      | URL                              |
|-------------|----------------------------------|
| Cashly App  | http://localhost:8080            |
| AI Agent    | http://localhost:8001/docs       |
| PostgreSQL  | localhost:5433 (externo)         |

### 5. Parar os serviços

```bash
make down       # para e remove containers (dados preservados)
make down-v     # para e remove TUDO incluindo dados do banco
```

## Arquitetura dos containers

```
┌─────────────────────────────────────────┐
│           Docker Network                │
│                                         │
│  ┌──────────┐    ┌──────────────────┐   │
│  │ postgres │◄───│  app (Spring)    │   │
│  │  :5432   │    │     :8080        │   │
│  └──────────┘    └────────┬─────────┘   │
│                           │             │
│                  ┌────────▼─────────┐   │
│                  │   ai-agent       │   │
│                  │ (FastAPI) :8001  │   │
│                  └──────────────────┘   │
└─────────────────────────────────────────┘
```

## Variáveis de ambiente

| Variável          | Obrigatório | Padrão   | Descrição                       |
|-------------------|-------------|----------|---------------------------------|
| `DB_USER`         | Não         | `myuser` | Usuário PostgreSQL              |
| `DB_PASSWORD`     | **Sim**     | —        | Senha PostgreSQL                |
| `GEMINI_API_KEY`  | **Sim**     | —        | Chave API Google Gemini         |

## Solução de problemas

**App não conecta ao banco:**
```bash
make logs-app   # verifique o erro
docker compose ps  # confirme que postgres está "healthy"
```

**AI Agent não responde:**
```bash
docker compose logs -f ai-agent
# Verifique se GEMINI_API_KEY está correta no .env
```

**Rebuild após mudança de código:**
```bash
docker compose build app   # rebuild apenas do backend
docker compose up -d app   # reinicia o backend
```
