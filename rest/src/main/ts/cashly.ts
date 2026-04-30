// Declaração do Chart.js (carregado via CDN no HTML)
declare const Chart: any;

const API: string = '/api/pagamentos';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type TipoPagamento = 'ENTRADA' | 'SAIDA';
type StatusIA = 'PENDENTE' | 'CATEGORIZADO' | 'REVISADO';
type StatusPagamento = 'PENDENTE' | 'PAGO' | 'CANCELADO';
type ToastType = 'success' | 'error' | 'info';

interface Transaction {
    id: number;
    tipo: TipoPagamento;
    valor: number;
    data: string | null;
    descricao: string | null;
    categoria: string | null;
    origem: string | null;
    statusIA: StatusIA;
    statusPagamento: StatusPagamento;
}

interface TransactionPayload {
    tipo: TipoPagamento;
    valor: number;
    data: string;
    descricao: string;
    categoria: string | null;
    origem: string | null;
}

interface AppState {
    transactions: Transaction[];
    filtered: Transaction[];
    sortField: keyof Transaction;
    sortDir: 'asc' | 'desc';
    searchText: string;
    filterTipo: TipoPagamento | '';
    filterStatus: StatusIA | '';
    page: number;
    pageSize: number;
    chart: any | null;
    editingId: number | null;
}

const state: AppState = {
    transactions: [],
    filtered: [],
    sortField: 'data',
    sortDir: 'desc',
    searchText: '',
    filterTipo: '',
    filterStatus: '',
    page: 0,
    pageSize: 15,
    chart: null,
    editingId: null,
};

// ─── Helpers de DOM ───────────────────────────────────────────────────────────
function getEl<T extends HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Elemento #${id} não encontrado`);
    return el as T;
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadTransactions();
    setupModal();
    setupImport();
    setupSearch();
});

// ─── LOAD ─────────────────────────────────────────────────────────────────────
async function loadTransactions(): Promise<void> {
    showSkeletons();
    try {
        const res = await fetch(API);
        if (!res.ok) throw new Error(await res.text());
        state.transactions = (await res.json()) as Transaction[];
        applyFilters();
        updateSummaryCards();
        renderChart();
    } catch (err) {
        console.error(err);
        toast('Erro ao carregar transações', 'error');
    }
}

// ─── SEARCH / FILTER ──────────────────────────────────────────────────────────
function setupSearch(): void {
    getEl<HTMLInputElement>('searchInput').addEventListener('input', (e) => {
        state.searchText = (e.target as HTMLInputElement).value.trim().toLowerCase();
        state.page = 0;
        applyFilters();
    });
    getEl<HTMLSelectElement>('filterTipo').addEventListener('change', (e) => {
        state.filterTipo = (e.target as HTMLSelectElement).value as TipoPagamento | '';
        state.page = 0;
        applyFilters();
    });
    getEl<HTMLSelectElement>('filterStatus').addEventListener('change', (e) => {
        state.filterStatus = (e.target as HTMLSelectElement).value as StatusIA | '';
        state.page = 0;
        applyFilters();
    });
}

function applyFilters(): void {
    let data: Transaction[] = [...state.transactions];

    if (state.searchText) {
        data = data.filter(
            (t) =>
                (t.descricao ?? '').toLowerCase().includes(state.searchText) ||
                (t.categoria ?? '').toLowerCase().includes(state.searchText) ||
                (t.origem ?? '').toLowerCase().includes(state.searchText)
        );
    }
    if (state.filterTipo) data = data.filter((t) => t.tipo === state.filterTipo);
    if (state.filterStatus) data = data.filter((t) => t.statusIA === state.filterStatus);

    data.sort((a, b) => {
        let va: string | number = a[state.sortField] as string ?? '';
        let vb: string | number = b[state.sortField] as string ?? '';
        if (state.sortField === 'valor') {
            va = Number(va);
            vb = Number(vb);
        }
        if (va < vb) return state.sortDir === 'asc' ? -1 : 1;
        if (va > vb) return state.sortDir === 'asc' ? 1 : -1;
        return 0;
    });

    state.filtered = data;
    renderTable();
    renderPagination();
}

// ─── SORT ─────────────────────────────────────────────────────────────────────
function sortBy(field: keyof Transaction): void {
    if (state.sortField === field) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
        state.sortField = field;
        state.sortDir = 'desc';
    }
    document.querySelectorAll('thead th').forEach((th) => th.classList.remove('sorted'));
    const th = document.querySelector<HTMLElement>(`thead th[data-sort="${field}"]`);
    if (th) th.classList.add('sorted');
    applyFilters();
}

// ─── RENDER TABLE ─────────────────────────────────────────────────────────────
function renderTable(): void {
    const tbody = getEl<HTMLTableSectionElement>('transacoesTbody');
    const start = state.page * state.pageSize;
    const slice = state.filtered.slice(start, start + state.pageSize);

    if (slice.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9">
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>Nenhuma transação encontrada</p>
      </div>
    </td></tr>`;
        return;
    }

    tbody.innerHTML = slice
        .map((t) => {
            const isEntrada = t.tipo === 'ENTRADA';
            const valorStr = `${isEntrada ? '+' : '-'} R$ ${formatMoney(t.valor)}`;
            const valorClass = isEntrada ? 'valor-up' : 'valor-down';
            const tipoClass = isEntrada ? 'tipo-entrada' : 'tipo-saida';
            const statusIA = t.statusIA ?? 'PENDENTE';
            return `<tr>
        <td><span class="tipo-badge ${tipoClass}">${t.tipo}</span></td>
        <td class="${valorClass}">${valorStr}</td>
        <td>${formatDate(t.data)}</td>
        <td>${t.descricao ?? '—'}</td>
        <td>${t.categoria ?? '—'}</td>
        <td>${t.origem ?? '—'}</td>
        <td><span class="status-dot ${statusIA}"></span>${statusIA}</td>
        <td>${t.statusPagamento ?? '—'}</td>
        <td>
          <button class="btn-icon" onclick="editTransaction(${t.id})">✏</button>
          <button class="btn-icon del" onclick="deleteTransaction(${t.id})">🗑</button>
        </td>
      </tr>`;
        })
        .join('');
}

// ─── PAGINATION ───────────────────────────────────────────────────────────────
function renderPagination(): void {
    const total = state.filtered.length;
    const totalPages = Math.ceil(total / state.pageSize);
    const start = total === 0 ? 0 : state.page * state.pageSize + 1;
    const end = Math.min((state.page + 1) * state.pageSize, total);

    getEl('pageInfo').textContent =
        total === 0 ? '0 registros' : `${start}–${end} de ${total}`;

    const btns = getEl('pageBtns');
    btns.innerHTML = '';

    const prev = document.createElement('button');
    prev.className = 'page-btn';
    prev.textContent = '‹';
    prev.disabled = state.page === 0;
    prev.addEventListener('click', () => goPage(state.page - 1));
    btns.appendChild(prev);

    Array.from({ length: totalPages }, (_, i) => {
        const b = document.createElement('button');
        b.className = 'page-btn' + (i === state.page ? ' active' : '');
        b.textContent = String(i + 1);
        b.addEventListener('click', () => goPage(i));
        btns.appendChild(b);
    });

    const next = document.createElement('button');
    next.className = 'page-btn';
    next.textContent = '›';
    next.disabled = state.page >= totalPages - 1;
    next.addEventListener('click', () => goPage(state.page + 1));
    btns.appendChild(next);
}

function goPage(p: number): void {
    const total = Math.ceil(state.filtered.length / state.pageSize);
    if (p < 0 || p >= total) return;
    state.page = p;
    renderTable();
    renderPagination();
}

// ─── SUMMARY CARDS ────────────────────────────────────────────────────────────
function updateSummaryCards(): void {
    const entradas = state.transactions
        .filter((t) => t.tipo === 'ENTRADA')
        .reduce((s, t) => s + Number(t.valor), 0);
    const saidas = state.transactions
        .filter((t) => t.tipo === 'SAIDA')
        .reduce((s, t) => s + Number(t.valor), 0);
    const saldo = entradas - saidas;
    const pendentes = state.transactions.filter((t) => t.statusIA === 'PENDENTE').length;

    const cardSaldo = getEl('cardSaldo');
    cardSaldo.textContent = `R$ ${formatMoney(saldo)}`;
    cardSaldo.className = 'card-value ' + (saldo >= 0 ? 'up' : 'down');

    getEl('cardEntradas').textContent = `R$ ${formatMoney(entradas)}`;
    getEl('cardSaidas').textContent = `R$ ${formatMoney(saidas)}`;
    getEl('cardPendentes').textContent = String(pendentes);

    const tSaldo = getEl('tickerSaldo');
    tSaldo.textContent = `R$ ${formatMoney(saldo)}`;
    tSaldo.className = saldo >= 0 ? 'up' : 'down';
    getEl('tickerEntradas').textContent = `R$ ${formatMoney(entradas)}`;
    getEl('tickerSaidas').textContent = `R$ ${formatMoney(saidas)}`;
    getEl('tickerCount').textContent = String(pendentes);
}

// ─── CHART ────────────────────────────────────────────────────────────────────
function renderChart(): void {
    const byMonth: Record<string, { entrada: number; saida: number }> = {};

    state.transactions.forEach((t) => {
        const month = (t.data ?? '').substring(0, 7);
        if (!month) return;
        if (!byMonth[month]) byMonth[month] = { entrada: 0, saida: 0 };
        if (t.tipo === 'ENTRADA') byMonth[month].entrada += Number(t.valor);
        else byMonth[month].saida += Number(t.valor);
    });

    const labels = Object.keys(byMonth).sort();
    const entradas = labels.map((m) => byMonth[m].entrada);
    const saidas = labels.map((m) => byMonth[m].saida);

    if (state.chart) state.chart.destroy();

    const canvas = getEl<HTMLCanvasElement>('cashlyChart');
    const ctx = canvas.getContext('2d')!;
    state.chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.map((l) => {
                const [y, m] = l.split('-');
                return `${m}/${y}`;
            }),
            datasets: [
                {
                    label: 'Entradas',
                    data: entradas,
                    backgroundColor: 'rgba(0,255,136,0.5)',
                    borderColor: '#00ff88',
                    borderWidth: 1,
                    borderRadius: 4,
                },
                {
                    label: 'Saídas',
                    data: saidas,
                    backgroundColor: 'rgba(255,59,107,0.5)',
                    borderColor: '#ff3b6b',
                    borderWidth: 1,
                    borderRadius: 4,
                },
            ],
        },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: { color: '#64748b', font: { family: 'Space Grotesk' } } },
            },
            scales: {
                x: { grid: { color: '#1e3a5f' }, ticks: { color: '#64748b' } },
                y: {
                    grid: { color: '#1e3a5f' },
                    ticks: { color: '#64748b', callback: (v: number) => `R$ ${formatMoney(v)}` },
                },
            },
        },
    });
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
function setupModal(): void {
    getEl('btnNova').addEventListener('click', openModalNew);
    getEl('modalClose').addEventListener('click', closeModal);
    getEl('modalOverlay').addEventListener('click', (e) => {
        if (e.target === getEl('modalOverlay')) closeModal();
    });
    getEl('formTransacao').addEventListener('submit', (e) => submitForm(e as SubmitEvent));
}

function openModalNew(): void {
    state.editingId = null;
    getEl('modalTitle').textContent = '+ Nova Transação';
    (getEl<HTMLFormElement>('formTransacao')).reset();
    getEl<HTMLInputElement>('inputData').value = new Date().toISOString().split('T')[0];
    getEl('modalOverlay').classList.add('open');
}

function editTransaction(id: number): void {
    const t = state.transactions.find((t) => t.id === id);
    if (!t) return;
    state.editingId = id;
    getEl('modalTitle').textContent = 'Editar Transação';
    getEl<HTMLSelectElement>('inputTipo').value = t.tipo ?? 'ENTRADA';
    getEl<HTMLInputElement>('inputValor').value = String(t.valor ?? '');
    getEl<HTMLInputElement>('inputData').value = t.data ?? '';
    getEl<HTMLInputElement>('inputDescricao').value = t.descricao ?? '';
    getEl<HTMLInputElement>('inputCategoria').value = t.categoria ?? '';
    getEl<HTMLInputElement>('inputOrigem').value = t.origem ?? '';
    getEl('modalOverlay').classList.add('open');
}

function closeModal(): void {
    getEl('modalOverlay').classList.remove('open');
}

async function submitForm(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    const btn = getEl<HTMLButtonElement>('btnSalvar');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    const body: TransactionPayload = {
        tipo: getEl<HTMLSelectElement>('inputTipo').value as TipoPagamento,
        valor: parseFloat(getEl<HTMLInputElement>('inputValor').value),
        data: getEl<HTMLInputElement>('inputData').value,
        descricao: getEl<HTMLInputElement>('inputDescricao').value,
        categoria: getEl<HTMLInputElement>('inputCategoria').value || null,
        origem: getEl<HTMLInputElement>('inputOrigem').value || null,
    };

    const url = state.editingId != null ? `${API}/${state.editingId}` : API;
    const method = state.editingId != null ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());
        toast(state.editingId != null ? 'Transação atualizada!' : 'Transação criada!', 'success');
        closeModal();
        void loadTransactions();
    } catch (err) {
        toast('Erro ao salvar: ' + (err instanceof Error ? err.message : String(err)), 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Salvar';
    }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
async function deleteTransaction(id: number): Promise<void> {
    if (!confirm('Deseja remover esta transação?')) return;
    try {
        const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(await res.text());
        toast('Transação removida', 'success');
        void loadTransactions();
    } catch (err) {
        toast('Erro ao remover: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
}

// ─── IMPORT / EXPORT ──────────────────────────────────────────────────────────
function setupImport(): void {
    const dropZone = getEl('dropZone');
    const fileInput = getEl<HTMLInputElement>('fileInput');

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const file = (e as DragEvent).dataTransfer?.files[0];
        if (file) void uploadFile(file);
    });
    fileInput.addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) void uploadFile(file);
    });
}

async function uploadFile(file: File): Promise<void> {
    if (!file.name.endsWith('.xlsx')) {
        toast('Apenas arquivos .xlsx são suportados', 'error');
        return;
    }
    toast('Importando...', 'info');
    const formData = new FormData();
    formData.append('arquivo', file);
    try {
        const res = await fetch(`${API}/importar`, { method: 'POST', body: formData });
        const erros: string[] = (await res.json()) as string[];
        toast(
            !erros || erros.length === 0 ? 'Importação concluída!' : `Importado com ${erros.length} aviso(s)`,
            !erros || erros.length === 0 ? 'success' : 'info'
        );
        void loadTransactions();
    } catch (err) {
        toast('Erro na importação: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
}

async function exportarRelatorio(): Promise<void> {
    try {
        const res = await fetch(`${API}/relatorio`);
        if (!res.ok) throw new Error(await res.text());
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cashly-relatorio-${new Date().toISOString().split('T')[0]}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (err) {
        toast('Erro ao exportar: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
}

// ─── SKELETONS ────────────────────────────────────────────────────────────────
function showSkeletons(): void {
    getEl('transacoesTbody').innerHTML = Array.from(
        { length: 8 },
        () =>
            `<tr>${Array.from(
                { length: 9 },
                () => `<td><div class="skeleton" style="width:${60 + Math.random() * 60}%"></div></td>`
            ).join('')}</tr>`
    ).join('');
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function toast(msg: string, type: ToastType = 'info'): void {
    const icons: Record<ToastType, string> = { success: '✓', error: '✕', info: 'ℹ' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type]}</span> ${msg}`;
    getEl('toastContainer').appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; }, 3500);
    setTimeout(() => { el.remove(); }, 3800);
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function formatMoney(v: number | string): string {
    return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: string | null): string {
    if (!d) return '—';
    const parts = d.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
}

// Expor globalmente as funções chamadas via onclick no HTML
(window as any).sortBy = sortBy;
(window as any).editTransaction = editTransaction;
(window as any).deleteTransaction = deleteTransaction;
(window as any).exportarRelatorio = exportarRelatorio;
(window as any).toggleAIPanel = toggleAIPanel;
(window as any).enviarMsgIA = enviarMsgIA;
(window as any).classificarPendentes = classificarPendentes;

// ─── AI AGENT PANEL ───────────────────────────────────────────────────────────

let aiPanelOpen = false;

function toggleAIPanel(): void {
    const panel = document.getElementById('aiPanel')!;
    const backdrop = document.getElementById('aiBackdrop')!;
    const btn = document.getElementById('btnAI')!;
    aiPanelOpen = !aiPanelOpen;
    panel.classList.toggle('open', aiPanelOpen);
    backdrop.classList.toggle('open', aiPanelOpen);
    btn.classList.toggle('active', aiPanelOpen);
}

function addAIMessage(text: string, role: 'bot' | 'user', isThinking = false): HTMLElement {
    const container = document.getElementById('aiMessages')!;
    const msg = document.createElement('div');
    msg.className = `ai-msg ${role === 'user' ? 'ai-msg-user' : ''}`;

    const avatar = document.createElement('div');
    avatar.className = `ai-avatar ${role === 'user' ? 'ai-avatar-user' : ''}`;
    avatar.textContent = role === 'user' ? '👤' : '✦';

    const bubble = document.createElement('div');
    if (isThinking) {
        bubble.className = 'ai-bubble ai-bubble-thinking';
        bubble.innerHTML = '<div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div>';
    } else {
        bubble.className = 'ai-bubble';
        bubble.innerHTML = text;
    }

    if (role === 'user') {
        msg.appendChild(bubble);
        msg.appendChild(avatar);
    } else {
        msg.appendChild(avatar);
        msg.appendChild(bubble);
    }

    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    return msg;
}

async function enviarMsgIA(): Promise<void> {
    const input = document.getElementById('aiInput') as HTMLInputElement;
    const sendBtn = document.querySelector('.ai-send-btn') as HTMLButtonElement;
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    addAIMessage(text, 'user');
    sendBtn.disabled = true;

    const thinkingMsg = addAIMessage('', 'bot', true);

    try {
        const res = await fetch('/api/pagamentos/ai/classify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ descricao: text })
        });

        thinkingMsg.remove();

        if (res.ok) {
            const data = await res.json();
            const categoria = data.categoria || data.category || data.result || JSON.stringify(data);
            addAIMessage(
                `Categoria identificada: <strong style="color:var(--ai-purple)">${categoria}</strong><br>
                <span style="color:var(--text-muted);font-size:12px">Confiança baseada na descrição fornecida.</span>`,
                'bot'
            );
        } else {
            addAIMessage('Não consegui classificar essa transação. Tente uma descrição mais detalhada.', 'bot');
        }
    } catch {
        thinkingMsg.remove();
        addAIMessage('Agente IA indisponível no momento. Verifique se o serviço está rodando na porta 8001.', 'bot');
    } finally {
        sendBtn.disabled = false;
        input.focus();
    }
}

async function classificarPendentes(): Promise<void> {
    const thinkingMsg = addAIMessage('', 'bot', true);
    const sendBtn = document.querySelector('.ai-send-btn') as HTMLButtonElement;
    sendBtn.disabled = true;

    try {
        const res = await fetch('/api/pagamentos/ai/classify-pending', { method: 'POST' });
        thinkingMsg.remove();

        if (res.ok) {
            const data = await res.json();
            const count = data.classified ?? data.count ?? '?';
            addAIMessage(
                `✅ <strong>${count}</strong> transações classificadas com sucesso!<br>
                <span style="color:var(--text-muted);font-size:12px">Atualize a tabela para ver as categorias.</span><br>
                <button class="btn-ai-action" onclick="loadTransactions()">↻ Atualizar tabela</button>`,
                'bot'
            );
            await loadTransactions();
        } else {
            addAIMessage('Nenhuma transação pendente encontrada ou erro na classificação.', 'bot');
        }
    } catch {
        thinkingMsg.remove();
        addAIMessage('Agente IA indisponível. Verifique se o serviço está rodando na porta 8001.', 'bot');
    } finally {
        sendBtn.disabled = false;
    }
}
