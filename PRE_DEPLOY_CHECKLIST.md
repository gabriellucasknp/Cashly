# Checklist Pré-Deploy — CASHLY

Situação atual: API rodando, banco MySQL + agente IA funcionando em Docker.
O que falta: testar a API, construir o frontend e acertar 4 pontos antes do `docker compose up`.

---

## Etapa 1 — Testar a API no Postman

Todos os endpoints abaixo devem retornar sucesso antes de partir para o front.

### 1.1 Criar uma transação
- **Método:** `POST`
- **URL:** `http://localhost:8080/api/pagamentos`
- **Headers:** `Content-Type: application/json`
- **Body (raw JSON):**
```json
{
  "tipo": "ENTRADA",
  "valor": 1500.00,
  "data": "2026-04-22",
  "descricao": "Salário",
  "categoria": "",
  "origem": "Empresa X"
}
```
- **Esperado:** `201 Created` com o objeto salvo e `statusIA: "PENDENTE"`

### 1.2 Listar todas as transações
- **Método:** `GET`
- **URL:** `http://localhost:8080/api/pagamentos`
- **Esperado:** `200 OK` com array contendo a transação criada

### 1.3 Buscar por ID
- **Método:** `GET`
- **URL:** `http://localhost:8080/api/pagamentos/1`
- **Esperado:** `200 OK` com o objeto

### 1.4 Editar uma transação
- **Método:** `PUT`
- **URL:** `http://localhost:8080/api/pagamentos/1`
- **Headers:** `Content-Type: application/json`
- **Body:** mesmo formato do POST, com valores alterados
- **Esperado:** `200 OK`

### 1.5 Deletar uma transação
- **Método:** `DELETE`
- **URL:** `http://localhost:8080/api/pagamentos/1`
- **Esperado:** `204 No Content`

### 1.6 Importar planilha `.xlsx`
- **Método:** `POST`
- **URL:** `http://localhost:8080/api/pagamentos/importar`
- **Body:** `form-data`, campo `arquivo`, valor = arquivo `.xlsx`
- **Esperado:** `200 OK` com lista (vazia = sem erros)

### 1.7 Exportar relatório
- **Método:** `GET`
- **URL:** `http://localhost:8080/api/pagamentos/relatorio`
- **Esperado:** `200 OK` com download de arquivo `.xlsx`

### 1.8 Testar classificação pela IA
- Crie uma transação com `"categoria": ""` (deixe em branco)
- O `SchedulerService` classifica automaticamente a cada 1h
- Para forçar no Postman, crie e espere o agente IA estar saudável
- Verifique depois via `GET /api/pagamentos/{id}` se `statusIA` mudou para `CATEGORIZADO`

---

## Etapa 2 — Criar o Frontend Thymeleaf

> Siga o guia completo em `rest/CASHLY_FRONTEND.md`. Abaixo o resumo do que criar.

### 2.1 Criar `ViewController.java`
- **Caminho:** `rest/src/main/java/com/planilhaautomatizada/rest/controller/ViewController.java`
- Anotação `@Controller` (não `@RestController`)
- Método `GET /` retornando `String "index"`

### 2.2 Criar `cashly.css`
- **Caminho:** `rest/src/main/resources/static/css/cashly.css`
- Tema dark com variáveis de cor, navbar, cards, tabela, modal, toasts, skeleton

### 2.3 Criar `cashly.js`
- **Caminho:** `rest/src/main/resources/static/js/cashly.js`
- Fetch API puro: loadTransactions, filtros, ordenação, paginação, modal, import/export

### 2.4 Criar `index.html`
- **Caminho:** `rest/src/main/resources/templates/index.html`
- Template Thymeleaf com `th:href="@{/css/cashly.css}"` e `th:src="@{/js/cashly.js}"`

### 2.5 Adicionar cache=false no dev
- **Arquivo:** `rest/src/main/resources/application-dev.properties`
- Adicionar: `spring.thymeleaf.cache=false`

---

## Etapa 3 — Testar o Frontend

```bash
cd rest
.\mvnw.cmd spring-boot:run
```

Abrir `http://localhost:8080` e verificar:

- [ ] Página carrega sem erros no console do navegador (F12)
- [ ] Cards de resumo exibem os valores (mesmo que R$ 0,00 com banco vazio)
- [ ] Ticker no navbar atualiza após criar uma transação
- [ ] Botão "+ Nova" abre o modal corretamente
- [ ] Criar uma transação pelo modal → aparece na tabela
- [ ] Editar uma transação → dados carregam no modal
- [ ] Deletar uma transação → some da tabela
- [ ] Busca em tempo real funciona
- [ ] Filtros de tipo e status funcionam
- [ ] Ordenação por coluna funciona (clicar no `<th>`)
- [ ] Paginação funciona (criar mais de 15 transações)
- [ ] Gráfico de barras por mês aparece e atualiza
- [ ] Importar `.xlsx` via drag & drop funciona
- [ ] Exportar relatório baixa o arquivo
- [ ] Toasts aparecem nas ações (sucesso/erro)

---

## Etapa 4 — Ajustes obrigatórios antes do Deploy

### 4.1 Restringir o `@CrossOrigin`
**Arquivo:** `rest/src/main/java/com/planilhaautomatizada/rest/controller/Controller.java`

Substituir:
```java
@CrossOrigin(origins = "*")
```
Por:
```java
@CrossOrigin(origins = "${app.cors.allowed-origins}")
```
E adicionar em `application-prod.properties`:
```properties
app.cors.allowed-origins=https://seu-dominio.com
```
Em `application-dev.properties`:
```properties
app.cors.allowed-origins=http://localhost:8080
```

### 4.2 Corrigir o ENTRYPOINT do Dockerfile para usar o perfil prod
**Arquivo:** `rest/Dockerfile`

Substituir a última linha:
```dockerfile
ENTRYPOINT ["java", "-jar", "app.jar"]
```
Por:
```dockerfile
ENTRYPOINT ["java", "-Dspring.profiles.active=prod", "-jar", "app.jar"]
```

### 4.3 Adicionar o serviço Spring Boot no `compose.yaml`
**Arquivo:** `rest/compose.yaml`

O compose atual sobe apenas o MySQL e o ai-agent. Para deploy completo, adicionar o serviço `rest` após o bloco `ai-agent`:

```yaml
  rest:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - '8080:8080'
    env_file:
      - .env
    depends_on:
      mysql:
        condition: service_healthy
      ai-agent:
        condition: service_started
    restart: unless-stopped
```

### 4.4 Criar o arquivo `.env` de produção
**Arquivo:** `rest/.env` (criar — não commitar no Git)

```env
DB_URL=jdbc:mysql://mysql:3306/pagamentos
DB_USER=myuser
DB_PASSWORD=secret
```

> **Atenção:** o host é `mysql` (nome do serviço no compose), não `localhost`.
> O `.env` do ai-agent já existe em `rest/ai-agent/.env`.

### 4.5 Completar o `application-prod.properties`
**Arquivo:** `rest/src/main/resources/application-prod.properties`

Adicionar as configurações que estão apenas no `application.properties` base:

```properties
spring.jpa.hibernate.ddl-auto=update
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.MySQLDialect
spring.jpa.open-in-view=false
```

### 4.6 Remover arquivo perdido na pasta `templates/`
**Arquivo a deletar:** `rest/src/main/resources/templates/aplication-prod.properties`

Esse arquivo foi criado por engano na pasta `templates/`. O Thymeleaf tenta renderizá-lo como HTML e causa erro. Pode deletar.

### 4.7 Garantir que `rest/.env` está no `.gitignore`
**Arquivo:** `rest/.gitignore` ou `.gitignore` raiz

Verificar se estas linhas existem:
```
.env
*.env
ai-agent/.env
```

---

## Etapa 5 — Deploy com Docker Compose

Após todas as etapas anteriores concluídas:

```bash
cd rest

# 1. Build do JAR (garante que o código está compilado)
.\mvnw.cmd package -DskipTests

# 2. Subir tudo com Docker Compose (mysql + ai-agent + spring boot)
docker compose up --build -d

# 3. Verificar se todos os serviços estão saudáveis
docker compose ps

# 4. Ver logs em tempo real (opcional)
docker compose logs -f rest
```

Acessar em: `http://localhost:8080`

---

## Resumo Visual do Status

| # | Item | Status |
|---|------|--------|
| 1 | Testar API no Postman | ⏳ Pendente |
| 2.1 | Criar ViewController.java | ⏳ Pendente |
| 2.2 | Criar cashly.css | ⏳ Pendente |
| 2.3 | Criar cashly.js | ⏳ Pendente |
| 2.4 | Criar index.html | ⏳ Pendente |
| 2.5 | Adicionar thymeleaf.cache=false | ⏳ Pendente |
| 3 | Testar frontend no browser | ⏳ Pendente |
| 4.1 | Restringir @CrossOrigin | ⏳ Pendente |
| 4.2 | Corrigir ENTRYPOINT do Dockerfile (perfil prod) | ⏳ Pendente |
| 4.3 | Adicionar serviço `rest` no compose.yaml | ⏳ Pendente |
| 4.4 | Criar rest/.env com variáveis de produção | ⏳ Pendente |
| 4.5 | Completar application-prod.properties | ⏳ Pendente |
| 4.6 | Deletar templates/aplication-prod.properties | ⏳ Pendente |
| 4.7 | Verificar .gitignore protege os .env | ✅ Feito |
| 5 | Deploy com docker compose up --build | ⏳ Pendente |

---

## O que já está pronto

- ✅ API REST Spring Boot funcional (todos os endpoints implementados)
- ✅ Banco MySQL rodando em Docker com tabela `transacoes` criada
- ✅ Agente IA (FastAPI + Gemini) rodando em Docker na porta 8001
- ✅ Dockerfile multi-stage do Spring Boot
- ✅ Lombok configurado com `annotationProcessorPaths`
- ✅ Build Maven passando (`BUILD SUCCESS`)
- ✅ Profiles dev/prod separados
- ✅ Volume persistente para o MySQL
- ✅ Guia de criação do frontend em `CASHLY_FRONTEND.md`
