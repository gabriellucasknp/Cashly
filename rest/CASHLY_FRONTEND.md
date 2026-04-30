# CASHLY — Guia de Criação do Frontend Thymeleaf

Design inspirado nos dashboards de criptomoedas: tema escuro, indicadores verde/vermelho, gráficos animados e tabela interativa em tempo real.

---

## Visão Geral do que será construído

```
CASHLY Dashboard
├── Navbar com ticker animado (saldo em movimento)
├── Cards de resumo (Saldo Total / Entradas / Saídas / Pendentes IA)
├── Gráfico de barras por mês (Chart.js)
├── Tabela principal interativa com filtros, busca e paginação
├── Modal de nova/editar transação
└── Área de importar .xlsx com drag & drop + botão de exportar
```

---

## Arquivos a criar

```
rest/src/main/
├── java/com/planilhaautomatizada/rest/
│   └── controller/
│       └── ViewController.java          ← controller MVC (serve HTML)
├── resources/
│   ├── templates/
│   │   └── index.html                   ← página principal do dashboard
│   └── static/
│       ├── css/
│       │   └── cashly.css               ← estilos do tema crypto
│       └── js/
│           └── cashly.js                ← toda a interatividade
```

---

## Passo 1 — Criar o ViewController

Crie o arquivo `ViewController.java` dentro de `controller/`, no mesmo pacote do `Controller.java` existente.

**O que ele deve conter:**
- Anotação `@Controller` (não `@RestController`) — essa diferença faz o Spring retornar HTML em vez de JSON
- Um método mapeado para `GET /` que retorna a `String "index"` — o Thymeleaf vai procurar o arquivo `templates/index.html` automaticamente
- Sem `@ResponseBody`, sem retorno de objetos Java

> **Por que criar um controller separado?**
> O `Controller.java` usa `@RestController`, que serializa tudo para JSON. O `ViewController` usa `@Controller` puro, que interpreta o retorno como nome de template HTML. Misturar os dois na mesma classe causaria conflito.

---

## Passo 2 — Criar o arquivo CSS (`cashly.css`)

Crie `rest/src/main/resources/static/css/cashly.css`. Esse arquivo define a identidade visual do tema dark crypto.

### 2.1 — Variáveis de cor (`:root`)

Declare variáveis CSS para todas as cores do sistema. O objetivo é nunca usar cores hardcoded fora do `:root`:

- `--bg-primary`: o fundo geral da página → preto azulado escuro (ex: `#0a0e1a`)
- `--bg-card`: fundo dos painéis e cards → cinza escuro (ex: `#111827`)
- `--bg-card2`: variação levemente mais clara para hover de linhas
- `--border`: cor das bordas → azul petróleo escuro
- `--green`: cor de entrada/positivo → verde neon (ex: `#00ff88`)
- `--green-dim`: versão transparente do verde para fundos de badge
- `--red`: cor de saída/negativo → vermelho vibrante (ex: `#ff3b6b`)
- `--red-dim`: versão transparente do vermelho
- `--yellow`: cor de alerta (transações pendentes de IA)
- `--text`: cor do texto principal → branco acinzentado
- `--text-muted`: cor de texto secundário → cinza médio
- `--accent`: azul de destaque para botões e foco
- `--font`: fonte principal — use `Space Grotesk` do Google Fonts com fallback para `Segoe UI`

### 2.2 — Reset e body

- Reset global: `box-sizing: border-box`, zere margin e padding de todos os elementos
- `body`: aplique `--bg-primary` como fundo, `--text` como cor, `--font` como fonte, e `min-height: 100vh`
- Estilize a scrollbar personalizada com `::-webkit-scrollbar` usando as cores do tema

### 2.3 — Navbar

A navbar deve ser fixa no topo (`position: sticky; top: 0`) e ter altura de `64px`. Organize em 3 seções com `flexbox`:

1. **Logo "CASHLY"** à esquerda: fonte grande, bold, com gradiente linear de `--green` para `--accent` aplicado via `-webkit-background-clip: text`
2. **Ticker bar** no centro: flex com `gap`, fonte monospace (Courier New), overflow hidden. Cada item tem um `.label` em `--text-muted` e o valor em `--green` (positivo) ou `--red` (negativo)
3. **Botões de ação** à direita: "Exportar" e "+ Nova"

### 2.4 — Botões (`.btn`)

Crie uma classe base `.btn` e variantes:
- `.btn-primary`: fundo `--accent`, branco. No hover, adicione `box-shadow` com `--accent-glow` para efeito de brilho
- `.btn-success`: fundo `--green-dim`, borda e texto `--green`. No hover, fundo sólido verde e texto preto
- `.btn-danger`: mesmo padrão com `--red`
- `.btn-outline`: fundo transparente, borda `--border`. No hover, borda e texto viram `--accent`

### 2.5 — Cards de resumo

- `summary-grid`: CSS Grid com `auto-fit` e `minmax(220px, 1fr)` para responsividade automática
- `summary-card`: fundo `--bg-card`, borda `--border`, border-radius arredondado. No hover, aplique `translateY(-3px)` com `transition`
- Cada card tem uma linha colorida no topo com `::before` de `height: 3px` usando cores diferentes por variante (`.card-saldo`, `.card-entrada`, `.card-saida`, `.card-ia`)
- `.card-value`: fonte grande, monospace, bold. Variantes `.up` (verde), `.down` (vermelho), `.neutral` (texto normal)
- `.card-badge`: pílula pequena com `border-radius: 99px`, variantes `.badge-up`, `.badge-down`, `.badge-info`

### 2.6 — Layout principal

Use CSS Grid com duas colunas: `1fr 380px` (tabela + painel lateral). Em telas menores que `1100px`, use `@media` para colapsar em coluna única.

### 2.7 — Tabela

- `table-panel`: fundo `--bg-card`, borda, border-radius, overflow hidden
- `panel-header` e `search-bar`: separados por `border-bottom: 1px solid --border`
- `search-input` e `filter-select`: fundo `--bg-primary`, borda `--border`. No foco, borda vira `--accent`
- `thead th`: texto em `--text-muted`, uppercase, letra pequena, cursor pointer (indicando que é clicável para ordenar). Classe `.sorted` destaca a coluna ativa em `--accent`
- `tbody tr`: hover com `--bg-card2`. Adicione uma `@keyframes fadeInRow` para animar linhas novas entrando da esquerda
- `.tipo-badge`: pílula com `.tipo-entrada` (verde) e `.tipo-saida` (vermelho)
- `.valor-up` / `.valor-down`: fonte monospace, bold, nas cores correspondentes
- `.status-dot`: bolinha colorida `8px × 8px`, com `box-shadow` de brilho para o status CATEGORIZADO
- `.btn-icon`: botão de ação minimalista. No hover `.del`, vira vermelho

### 2.8 — Painel lateral

Coluna do lado direito com dois painéis empilhados:
- `.chart-panel`: para o canvas do Chart.js
- `.io-panel`: para importar/exportar
- `.drop-zone`: área tracejada para drag & drop. No hover e quando `.drag-over`, borda e fundo viram `--accent`

### 2.9 — Modal

- `.modal-overlay`: posição `fixed`, cobre a tela inteira com fundo semi-transparente e `backdrop-filter: blur(4px)`. `display: none` por padrão; quando `.open`, use `display: flex` centralizado
- `.modal`: fundo `--bg-card`, borda, border-radius maior (16px), `max-width: 520px`. Adicione `@keyframes modalIn` com `scale(0.95)` → `scale(1)` e `translateY(-20px)` → `translateY(0)`
- Inputs do formulário: mesma estética dos search inputs
- `.form-row`: grid de duas colunas para campos lado a lado

### 2.10 — Toast e Skeleton

**Toast:**
- Container fixo no canto inferior direito com `z-index` alto
- Cada toast tem borda esquerda colorida (verde/vermelho/azul) e animação de entrada da direita
- Some após ~3,5s com `opacity: 0` e `transition`

**Skeleton loader:**
- Classe `.skeleton` com `height: 18px` e `border-radius: 4px`
- `background` com gradiente linear animado (`@keyframes shimmer`) de `--bg-card` para `--bg-card2` indo da direita para esquerda — efeito de "brilho passando"

### 2.11 — Paginação

- Flex entre `pageInfo` (texto "1–15 de 42") e botões de página
- `.page-btn`: botão pequeno com borda. No hover e `.active`, borda e texto viram `--accent`

---

## Passo 3 — Criar o JavaScript (`cashly.js`)

Crie `rest/src/main/resources/static/js/cashly.js`. Esse arquivo é responsável por toda a comunicação com a API e pela interatividade da página. **Não use nenhum framework** — apenas JavaScript puro com a Fetch API.

### 3.1 — Constante de URL e estado global

- Defina `const API = '/api/pagamentos'` como base de todas as requisições
- Crie um objeto `state` que guarda o estado atual da tela:
  - `transactions`: array com todos os dados vindos da API
  - `filtered`: array com os dados após aplicar filtros/busca
  - `sortField` e `sortDir`: coluna e direção da ordenação atual
  - `searchText`, `filterTipo`, `filterStatus`: valores dos filtros ativos
  - `page` e `pageSize`: controle de paginação (15 por página)
  - `chart`: referência ao objeto Chart.js para poder destruir e recriar
  - `editingId`: id da transação sendo editada no modal (`null` = nova)

### 3.2 — Inicialização

No evento `DOMContentLoaded`, chame:
1. `loadTransactions()` — busca os dados da API
2. `setupModal()` — configura os event listeners do modal
3. `setupImport()` — configura drag & drop e input de arquivo
4. `setupSearch()` — configura busca e filtros
5. `startTickerAnimation()` — inicia a animação do ticker

### 3.3 — Carregar transações (`loadTransactions`)

1. Chame `showSkeletons()` para exibir o loading antes de buscar
2. Faça `fetch(API)` com `await`
3. Se `!res.ok`, lance um erro e chame `toast('Erro ao carregar', 'error')`
4. Salve o resultado em `state.transactions`
5. Chame em sequência: `applyFilters()`, `updateSummaryCards()`, `renderChart()`

### 3.4 — Filtros (`setupSearch` e `applyFilters`)

`setupSearch`:
- Adicione listener `input` no `#searchInput` → atualiza `state.searchText`, reseta `state.page = 0`, chama `applyFilters()`
- Mesma lógica para os dois `<select>` de filtro (evento `change`)

`applyFilters`:
1. Copie `state.transactions` para uma variável local
2. Se `searchText` não estiver vazio, filtre por `descricao`, `categoria` e `origem` (toLowerCase + includes)
3. Se `filterTipo` estiver definido, filtre por `t.tipo`
4. Se `filterStatus` estiver definido, filtre por `t.statusIA`
5. Ordene pelo campo `state.sortField` e direção `state.sortDir`. Para `valor`, converta para `Number` antes de comparar
6. Salve em `state.filtered`
7. Chame `renderTable()` e `renderPagination()`

### 3.5 — Ordenação (`sortBy`)

Função chamada pelo `onclick` de cada `<th>`. Recebe o nome do campo:
1. Se já está ordenando pelo mesmo campo, inverta a direção; senão, defina o campo e direção `'desc'`
2. Remova a classe `.sorted` de todos os `<th>`
3. Adicione `.sorted` no `<th>` com `data-sort` igual ao campo
4. Chame `applyFilters()`

### 3.6 — Renderizar tabela (`renderTable`)

1. Calcule o slice com base em `state.page` e `state.pageSize`
2. Se o slice estiver vazio, injete uma linha com `empty-state` (ícone + mensagem)
3. Para cada transação, gere uma `<tr>` com:
   - Badge de tipo com classe `.tipo-entrada` ou `.tipo-saida`
   - Valor com `+` ou `-` na frente, cor verde ou vermelha
   - Data formatada (`dd/MM/yyyy`)
   - Bolinha de status IA com a classe correta
   - Badge de statusPagamento
   - Botões de editar e deletar com `onclick="editTransaction(id)"` e `onclick="deleteTransaction(id)"`
4. Injete tudo de uma vez no `innerHTML` do `<tbody>`

### 3.7 — Paginação (`renderPagination` e `goPage`)

`renderPagination`:
1. Calcule `totalPages`, `start` e `end` baseados no state
2. Atualize o texto `#pageInfo`
3. Gere os botões de página dinamicamente com `Array.from({length: totalPages})`. O botão da página atual recebe classe `.active`. Botões anterior/próximo ficam `disabled` nos extremos

`goPage(p)`: valida que `p` está dentro dos limites, atualiza `state.page`, chama `renderTable()` e `renderPagination()`

### 3.8 — Cards de resumo (`updateSummaryCards`)

1. Some os valores de todas as transações de tipo `ENTRADA` e `SAIDA` com `reduce`
2. Calcule o saldo como `entradas - saidas`
3. Conte quantas têm `statusIA === 'PENDENTE'`
4. Atualize os `textContent` dos 4 cards
5. Aplique classe `.up` ou `.down` no card de saldo conforme o valor
6. Atualize também os 4 itens do ticker no navbar com o mesmo formato

### 3.9 — Gráfico (`renderChart`)

1. Agrupe as transações por mês (`t.data.substring(0, 7)` → `"2026-04"`)
2. Para cada mês, some os valores de entrada e saída separadamente
3. Ordene os labels por data
4. Se `state.chart` já existir, chame `.destroy()` antes de criar um novo (evita duplicar canvas)
5. Crie um `new Chart(ctx, {...})` do tipo `'bar'` com dois datasets: Entradas (verde) e Saídas (vermelho)
6. Configure as escalas com cores do tema: grid em `#1e3a5f`, ticks em `#64748b`, callback do eixo Y formatando como `R$ valor`

### 3.10 — Modal (`setupModal`, `openModalNew`, `editTransaction`, `submitForm`)

`setupModal`:
- Listener no `#btnNova` → chama `openModalNew()`
- Listener no `#modalClose` e no overlay → chama `closeModal()`
- Listener no `submit` do formulário → chama `submitForm(e)`

`openModalNew`:
1. Defina `state.editingId = null`
2. Atualize o título do modal para "+ Nova Transação"
3. Resete o formulário
4. Preencha `#inputData` com a data de hoje (`new Date().toISOString().split('T')[0]`)
5. Adicione a classe `.open` ao overlay

`editTransaction(id)`:
1. Encontre a transação em `state.transactions` pelo id
2. Defina `state.editingId = id`
3. Atualize o título para "Editar Transação"
4. Preencha cada campo do formulário com os dados da transação
5. Abra o modal

`submitForm(e)`:
1. Chame `e.preventDefault()`
2. Desabilite o botão e mude o texto para "Salvando..."
3. Monte o objeto `body` com os valores dos inputs
4. Se `state.editingId` não for null → `PUT /api/pagamentos/{id}`; senão → `POST /api/pagamentos`
5. Se a resposta não for ok, lance erro com `res.text()`
6. No sucesso: exiba toast, feche o modal, recarregue as transações
7. No erro: exiba toast de erro
8. No `finally`: reabilite o botão

### 3.11 — Deletar (`deleteTransaction`)

1. Confirme com `confirm('...')`
2. Faça `fetch` com `method: 'DELETE'`
3. No sucesso: toast e `loadTransactions()`
4. No erro: toast de erro

### 3.12 — Import/Export (`setupImport`, `uploadFile`, `exportarRelatorio`)

`setupImport`:
- Click na `#dropZone` → aciona o `#fileInput` oculto
- `dragover`: chama `preventDefault()` e adiciona classe `.drag-over`
- `dragleave`: remove `.drag-over`
- `drop`: chama `preventDefault()`, remove `.drag-over`, pega `e.dataTransfer.files[0]`, chama `uploadFile(file)`
- Mudança no `#fileInput`: chama `uploadFile(file)`

`uploadFile(file)`:
1. Valide que o arquivo termina em `.xlsx`; se não, exiba toast de erro e retorne
2. Crie um `FormData` e adicione o arquivo com a chave `"arquivo"` (mesmo nome do `@RequestParam` na API)
3. Exiba toast "Importando..."
4. Faça `fetch` para `POST /api/pagamentos/importar`
5. Leia o JSON de resposta (lista de erros/avisos)
6. Se vazio: toast de sucesso; se não: toast com quantidade de avisos
7. Recarregue as transações

`exportarRelatorio`:
1. Faça `fetch` para `GET /api/pagamentos/relatorio`
2. Converta a resposta para `blob()`
3. Crie uma URL com `URL.createObjectURL(blob)`
4. Crie um `<a>` temporário, defina `href` e `download` com nome + data atual, clique e revogue a URL

### 3.13 — Skeletons, Toasts e Helpers

`showSkeletons`: substitui o conteúdo do `<tbody>` por 8 linhas de `<div class="skeleton">` para dar feedback visual de carregamento

`toast(msg, type)`:
1. Selecione o `#toastContainer`
2. Crie um `<div class="toast [type]">` com ícone + mensagem
3. Adicione ao container
4. Após 3500ms, aplique `opacity: 0` com `transition`
5. Após 3800ms, remova o elemento do DOM

`formatMoney(v)`: use `Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`

`formatDate(d)`: quebre o string `"2026-04-22"` pelo `-` e monte `"22/04/2026"`

---

## Passo 4 — Criar o template HTML (`index.html`)

Crie `rest/src/main/resources/templates/index.html`.

### Cabeçalho (`<head>`)

- `lang="pt-BR"` e `xmlns:th="http://www.thymeleaf.org"` na tag `<html>`
- Link para a fonte `Space Grotesk` via Google Fonts
- Script do Chart.js via CDN (coloque antes do seu CSS para evitar FOUC)
- Link do CSS com sintaxe Thymeleaf: `th:href="@{/css/cashly.css}"` — o `@{}` garante que o Spring resolva o caminho correto

### Navbar (`<nav class="navbar">`)

Três partes:
1. `<span class="navbar-logo">CASHLY</span>`
2. `<div class="ticker-bar">` com 4 `<span class="ticker-item">` tendo ids: `tickerSaldo`, `tickerEntradas`, `tickerSaidas`, `tickerCount` — o JavaScript vai preenchê-los
3. `<div class="navbar-actions">` com botão "Exportar" chamando `exportarRelatorio()` e botão "+ Nova" com `id="btnNova"`

### Cards de resumo

4 `<div class="summary-card card-[variante]">`, cada um com:
- `<div class="card-label">` com o nome
- `<div class="card-value" id="card[Nome]">` — ids: `cardSaldo`, `cardEntradas`, `cardSaidas`, `cardPendentes`
- `<span class="card-badge">` com descrição

### Grid principal (`<div class="main-grid">`)

**Coluna da tabela:**
- `<div class="table-panel">`
- `panel-header` com título "Transações" e botão "Atualizar" chamando `loadTransactions()`
- `search-bar` com: `<input id="searchInput">`, `<select id="filterTipo">` com opções `ENTRADA`/`SAIDA`, `<select id="filterStatus">` com opções `PENDENTE`/`CATEGORIZADO`/`REVISADO`
- `<table>` com `<thead>` contendo 9 colunas. Em cada `<th>`, adicione `data-sort="nomeDoCampo"` e `onclick="sortBy('nomeDoCampo')"`. O último `<th>` (AÇÕES) não tem sort
- `<tbody id="transacoesTbody">` vazio — o JS vai preenchê-lo
- Paginação com `<span id="pageInfo">` e `<div id="pageBtns">`

**Coluna lateral (`<aside class="side-panel">`):**
- `chart-panel` com `<canvas id="cashlyChart" height="220">`
- `io-panel` com `<div id="dropZone">`, `<input type="file" id="fileInput" accept=".xlsx" style="display:none">` e botão de exportar

### Modal

- `<div class="modal-overlay" id="modalOverlay">` fora do `<main>`
- Dentro: `<div class="modal">` com header (título `id="modalTitle"` + botão fechar `id="modalClose"`) e `<form id="formTransacao">`
- Campos do formulário:
  - `<select id="inputTipo">` com ENTRADA e SAÍDA
  - `<input type="number" id="inputValor">` com `step="0.01" min="0.01"`
  - `<input type="date" id="inputData">`
  - `<input type="text" id="inputDescricao" required>`
  - `<input type="text" id="inputCategoria">` (opcional — IA classifica se vazio)
  - `<input type="text" id="inputOrigem">` (opcional)
  - Botão `type="submit" id="btnSalvar"` com largura total

### Toasts e Script

- `<div class="toast-container" id="toastContainer">` antes do fechamento do `<body>`
- Script com sintaxe Thymeleaf: `<script th:src="@{/js/cashly.js}"></script>` — **sempre no final do body**, depois de todo o HTML

---

## Passo 5 — Configurar o application-dev.properties

Adicione a linha abaixo para desabilitar o cache do Thymeleaf em desenvolvimento (permite ver mudanças sem reiniciar):

```properties
spring.thymeleaf.cache=false
```

---

## Passo 6 — Rodar e testar

```bash
# Os containers Docker já devem estar no ar
cd rest
.\mvnw.cmd spring-boot:run
```

Abra no navegador: **http://localhost:8080**

A página deve carregar em branco (banco vazio), mas já funcional. Crie uma transação pelo botão "+ Nova" e veja o card e o ticker atualizarem automaticamente.

---

## Resultado Visual Esperado

```
┌─────────────────────────────────────────────────────────────────┐
│  CASHLY   SALDO R$2.500  ENTRADAS R$5.000  SAÍDAS R$2.500  ⬇+  │  ← Navbar ticker
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │  SALDO   │ │ ENTRADAS │ │  SAÍDAS  │ │ PEND. IA │          │  ← Cards
│  │ R$2.500  │ │ R$5.000  │ │ R$2.500  │ │    3     │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│                                                                  │
│  ┌─────────────────────────────────┐ ┌──────────────────────┐  │
│  │  [buscar...] [tipo▼] [status▼]  │ │  Gráfico de Barras   │  │
│  │ TIPO  VALOR     DATA  DESCRIÇÃO │ │  ████ Entradas       │  │
│  │ ENTR  +R$1.000  22/04 Salário   │ │  ████ Saídas         │  │
│  │ SAÍDA -R$350    21/04 Mercado   │ ├──────────────────────┤  │
│  │ ENTR  +R$500    20/04 Freela    │ │  [Drop .xlsx aqui]   │  │
│  └─────────────────────────────────┘ └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Resumo dos recursos interativos

| Recurso | Como implementar |
|---------|-----------------|
| Ticker animado | JS atualiza os `innerHTML` dos spans do navbar após cada `loadTransactions` |
| Cards com cores | Classes CSS dinâmicas (`.up` / `.down`) aplicadas pelo JS |
| Tabela ordenável | `onclick` nos `<th>` chama `sortBy()`, que reordena o array e re-renderiza |
| Busca em tempo real | Listener `input` no campo de texto atualiza o filtro a cada tecla |
| Filtros dropdown | Listeners `change` nos selects, mesma lógica |
| Paginação | `state.page` controla o slice do array exibido |
| Modal animado | Classe `.open` adicionada/removida via JS; animação via `@keyframes` CSS |
| Drag & Drop | Eventos `dragover`, `dragleave`, `drop` na drop zone |
| Exportar Excel | `fetch` → `blob()` → `<a download>` criado e clicado via JS |
| Skeleton loader | `innerHTML` do tbody substituído por divs `.skeleton` antes do fetch |
| Toast notifications | Elementos criados dinamicamente, removidos após timeout |
| Gráfico Chart.js | Dados agrupados por mês via JS, destruído e recriado a cada atualização |

---

## Próximas melhorias sugeridas

- Gráfico de pizza por categoria (tipo `doughnut` do Chart.js)
- Auto-refresh a cada 30s para ver a IA classificar em tempo real
- Filtro por período com campos de data início/fim
- Badge piscante para transações com status PENDENTE da IA
- Modo claro com toggle no navbar
