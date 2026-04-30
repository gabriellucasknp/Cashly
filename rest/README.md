# Planilha Automatizada — API REST Financeira

API REST para gerenciamento financeiro pessoal com classificação automática de transações via IA (Google Gemini).

---

## Arquitetura

```
rest/                         ← Spring Boot API
├── src/main/java/
│   └── com/planilhaautomatizada/rest/
│       ├── controller/       ← Endpoints REST + ViewController (Thymeleaf)
│       ├── dto/              ← Objetos de transferência de dados
│       ├── model/            ← Entidades JPA
│       ├── repository/       ← Acesso ao banco de dados
│       └── service/          ← Lógica de negócio
├── src/main/resources/
│   ├── templates/index.html  ← Dashboard (Thymeleaf)
│   ├── static/cashly.css     ← Tema dark
│   └── static/js/cashly.js  ← Gerado pelo TypeScript (src/main/ts/)
├── src/main/ts/cashly.ts     ← Fonte TypeScript do frontend
├── ai-agent/                 ← Microserviço Python (FastAPI, porta 8001)
│   ├── main.py               ← Agente de IA (Google Gemini)
│   ├── Dockerfile
│   └── requirements.txt
├── compose.yaml              ← Docker Compose (PostgreSQL + AI Agent + App)
└── Dockerfile                ← Build da API Spring Boot
```

---

## Pré-requisitos

- Java 17+
- Maven (ou use o `mvnw` incluído)
- Docker e Docker Compose
- Chave de API do Google Gemini ([obtenha aqui](https://aistudio.google.com/app/apikey))

---

## Configuração

### 1. Configurar o AI Agent

```bash
cd rest/ai-agent
# Edite .env e confirme que GEMINI_API_KEY está preenchida:
notepad .env
```

### 2. Subir o banco PostgreSQL e o AI Agent (desenvolvimento)

```bash
cd rest
docker compose up -d postgres ai-agent
```

Isso sobe:
- **PostgreSQL 16** na porta `5432`
- **AI Agent** (FastAPI + Gemini) na porta `8001`

### 3. Rodar a API Spring Boot localmente

```bash
cd rest
./mvnw spring-boot:run
```

A API e o dashboard estarão em `http://localhost:8080`

---

## Banco de Dados — PostgreSQL

O projeto usa **PostgreSQL 16** como banco de dados principal.

### Configuração local (development)

As credenciais padrão do ambiente de desenvolvimento estão em `application-dev.properties`:

| Parâmetro | Valor |
|-----------|-------|
| URL | `jdbc:postgresql://localhost:5432/pagamentos` |
| Usuário | `myuser` |
| Senha | `secret` |
| Banco | `pagamentos` |

O Docker Compose sobe o PostgreSQL automaticamente com esses valores.

### Configuração de produção

Defina as variáveis de ambiente (via `.env` ou plataforma de deploy):

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `DB_URL` | URL JDBC do PostgreSQL | `jdbc:postgresql://postgres:5432/pagamentos` |
| `DB_USER` | Usuário do banco | `myuser` |
| `DB_PASSWORD` | Senha do banco | `SenhaForte123!` |
| `CORS_ORIGINS` | Origens permitidas (CORS) | `https://meuapp.vercel.app` |

> **Deploy na Vercel / Neon / Supabase:** use o JDBC URL fornecido pelo provedor em `DB_URL`.  
> Para Neon ou Supabase, adicione `?sslmode=require` ao final da URL.

### Dialect e DDL

- Dialect: `org.hibernate.dialect.PostgreSQLDialect`
- DDL auto: `update` (cria/atualiza tabelas automaticamente)
- Tabela principal: `transacoes`

### Criar o banco manualmente (opcional)

Se preferir criar o banco sem o Docker Compose:

```sql
CREATE DATABASE pagamentos;
CREATE USER myuser WITH PASSWORD 'secret';
GRANT ALL PRIVILEGES ON DATABASE pagamentos TO myuser;
```

---

## Endpoints da API

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/pagamentos` | Cria uma nova transação |
| `GET` | `/api/pagamentos` | Lista todas as transações |
| `GET` | `/api/pagamentos/{id}` | Busca transação por ID |
| `PUT` | `/api/pagamentos/{id}` | Atualiza uma transação |
| `DELETE` | `/api/pagamentos/{id}` | Remove uma transação |
| `POST` | `/api/pagamentos/importar` | Importa planilha `.xlsx` |
| `GET` | `/api/pagamentos/relatorio` | Exporta relatório `.xlsx` |

### Exemplo de corpo (POST/PUT)

```json
{
  "tipo": "SAIDA",
  "valor": 150.00,
  "data": "2026-04-22",
  "descricao": "Supermercado Extra",
  "categoria": "Alimentação",
  "origem": "Débito"
}
```

### Tipos disponíveis

- **TipoPagamento**: `ENTRADA`, `SAIDA`
- **StatusIA**: `PENDENTE`, `CATEGORIZADO`, `REVISADO`
- **StatusPagamento**: `PENDENTE`, `PAGO`, `CANCELADO`

---

## Formato da Planilha para Importação

O arquivo `.xlsx` deve ter as colunas na seguinte ordem:

| Coluna | Conteúdo |
|--------|----------|
| A | Tipo (`ENTRADA` ou `SAIDA`) |
| B | Valor (número) |
| C | Data (formato de data do Excel) |
| D | Descrição |
| E | Categoria (opcional) |
| F | Origem (opcional) |

---

## Classificação por IA

Toda transação criada ou importada é automaticamente enviada ao microserviço Python que usa o **Google Gemini 2.0 Flash** para:

1. Classificar a categoria (Alimentação, Transporte, Salário, etc.)
2. Determinar o status do pagamento (PAGO, PENDENTE, CANCELADO)

Um **scheduler** roda a cada hora (configurável via `app.scheduler.interval-ms`) e reclassifica transações `PENDENTE`.

---

## Deploy Completo com Docker Compose

```bash
cd rest

# Copie e edite o .env (já existente com valores padrão)
notepad .env

# Sobe tudo: PostgreSQL + AI Agent + Spring Boot
docker compose up --build -d

# Logs
docker compose logs -f app
```

A aplicação ficará em `http://localhost:8080`.

---

## Problemas Corrigidos

| # | Problema | Status |
|---|----------|--------|
| 1 | Banco MySQL → migrado para **PostgreSQL 16** | ✅ |
| 2 | Arquivo `.properties` dentro de `templates/` causava erro no Thymeleaf | ✅ |
| 3 | `@CrossOrigin(origins = "*")` hardcoded — corrigido para ler de propriedade | ✅ |
| 4 | `AIClassifierService` sem `@PostConstruct` — construtor `@Value` não funciona com RestClient | ✅ |
| 5 | Dockerfile sem perfil `prod` no ENTRYPOINT | ✅ |
| 6 | Microserviço Python com definições duplicadas | ✅ |
| 7 | Frontend em JavaScript → migrado para **TypeScript** (compilado no build Maven) | ✅ |
| 8 | Healthcheck do `ai-agent` usava `curl` (não disponível em `python:3.12-slim`) | ✅ |

---

## Pendências pós-deploy

- [ ] Trocar `spring.jpa.hibernate.ddl-auto=update` para `validate` em produção (usar Flyway/Liquibase)
- [ ] Adicionar autenticação (Spring Security + JWT ou OAuth2)
- [ ] Configurar `CORS_ORIGINS` com o domínio real da Vercel/frontend



