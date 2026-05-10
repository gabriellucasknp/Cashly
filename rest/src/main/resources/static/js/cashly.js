"use strict";
const API = '/api/pagamentos';
const state = {
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
function getEl(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`Elemento #${id} não encontrado`);
    return el;
}
// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadTransactions();
    setupModal();
    setupImport();
    setupSearch();
    setupMicDescricao();
});
// ─── LOAD ─────────────────────────────────────────────────────────────────────
async function loadTransactions() {
    showSkeletons();
    try {
        const res = await fetch(API);
        if (!res.ok)
            throw new Error(await res.text());
        state.transactions = (await res.json());
        applyFilters();
        updateSummaryCards();
        renderChart();
    }
    catch (err) {
        console.error(err);
        toast('Erro ao carregar transações', 'error');
    }
}
// ─── SEARCH / FILTER ──────────────────────────────────────────────────────────
function setupSearch() {
    getEl('searchInput').addEventListener('input', (e) => {
        state.searchText = e.target.value.trim().toLowerCase();
        state.page = 0;
        applyFilters();
    });
    getEl('filterTipo').addEventListener('change', (e) => {
        state.filterTipo = e.target.value;
        state.page = 0;
        applyFilters();
    });
    getEl('filterStatus').addEventListener('change', (e) => {
        state.filterStatus = e.target.value;
        state.page = 0;
        applyFilters();
    });
}
function applyFilters() {
    let data = [...state.transactions];
    if (state.searchText) {
        data = data.filter((t) => (t.descricao ?? '').toLowerCase().includes(state.searchText) ||
            (t.categoria ?? '').toLowerCase().includes(state.searchText) ||
            (t.origem ?? '').toLowerCase().includes(state.searchText));
    }
    if (state.filterTipo)
        data = data.filter((t) => t.tipo === state.filterTipo);
    if (state.filterStatus)
        data = data.filter((t) => t.statusIA === state.filterStatus);
    data.sort((a, b) => {
        let va = a[state.sortField] ?? '';
        let vb = b[state.sortField] ?? '';
        if (state.sortField === 'valor') {
            va = Number(va);
            vb = Number(vb);
        }
        if (va < vb)
            return state.sortDir === 'asc' ? -1 : 1;
        if (va > vb)
            return state.sortDir === 'asc' ? 1 : -1;
        return 0;
    });
    state.filtered = data;
    renderTable();
    renderPagination();
}
// ─── SORT ─────────────────────────────────────────────────────────────────────
function sortBy(field) {
    if (state.sortField === field) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
    }
    else {
        state.sortField = field;
        state.sortDir = 'desc';
    }
    document.querySelectorAll('thead th').forEach((th) => th.classList.remove('sorted'));
    const th = document.querySelector(`thead th[data-sort="${field}"]`);
    if (th)
        th.classList.add('sorted');
    applyFilters();
}
// ─── RENDER TABLE ─────────────────────────────────────────────────────────────
function renderTable() {
    const tbody = getEl('transacoesTbody');
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
function renderPagination() {
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
function goPage(p) {
    const total = Math.ceil(state.filtered.length / state.pageSize);
    if (p < 0 || p >= total)
        return;
    state.page = p;
    renderTable();
    renderPagination();
}
// ─── SUMMARY CARDS ────────────────────────────────────────────────────────────
function updateSummaryCards() {
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
function renderChart() {
    const byMonth = {};
    state.transactions.forEach((t) => {
        const month = (t.data ?? '').substring(0, 7);
        if (!month)
            return;
        if (!byMonth[month])
            byMonth[month] = { entrada: 0, saida: 0 };
        if (t.tipo === 'ENTRADA')
            byMonth[month].entrada += Number(t.valor);
        else
            byMonth[month].saida += Number(t.valor);
    });
    const labels = Object.keys(byMonth).sort();
    const entradas = labels.map((m) => byMonth[m].entrada);
    const saidas = labels.map((m) => byMonth[m].saida);
    if (state.chart)
        state.chart.destroy();
    const canvas = getEl('cashlyChart');
    const ctx = canvas.getContext('2d');
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
                    ticks: { color: '#64748b', callback: (v) => `R$ ${formatMoney(v)}` },
                },
            },
        },
    });
}
// ─── MODAL ────────────────────────────────────────────────────────────────────
function setupModal() {
    getEl('btnNova').addEventListener('click', openModalNew);
    getEl('modalClose').addEventListener('click', closeModal);
    getEl('modalOverlay').addEventListener('click', (e) => {
        if (e.target === getEl('modalOverlay'))
            closeModal();
    });
    getEl('formTransacao').addEventListener('submit', (e) => submitForm(e));
}
function openModalNew() {
    state.editingId = null;
    getEl('modalTitle').textContent = '+ Nova Transação';
    (getEl('formTransacao')).reset();
    getEl('inputData').value = new Date().toISOString().split('T')[0];
    getEl('modalOverlay').classList.add('open');
}
function editTransaction(id) {
    const t = state.transactions.find((t) => t.id === id);
    if (!t)
        return;
    state.editingId = id;
    getEl('modalTitle').textContent = 'Editar Transação';
    getEl('inputTipo').value = t.tipo ?? 'ENTRADA';
    getEl('inputValor').value = String(t.valor ?? '');
    getEl('inputData').value = t.data ?? '';
    getEl('inputDescricao').value = t.descricao ?? '';
    getEl('inputCategoria').value = t.categoria ?? '';
    getEl('inputOrigem').value = t.origem ?? '';
    getEl('modalOverlay').classList.add('open');
}
function closeModal() {
    getEl('modalOverlay').classList.remove('open');
}
async function submitForm(e) {
    e.preventDefault();
    const btn = getEl('btnSalvar');
    btn.disabled = true;
    btn.textContent = 'Salvando...';
    const body = {
        tipo: getEl('inputTipo').value,
        valor: parseFloat(getEl('inputValor').value),
        data: getEl('inputData').value,
        descricao: getEl('inputDescricao').value,
        categoria: getEl('inputCategoria').value || null,
        origem: getEl('inputOrigem').value || null,
    };
    const url = state.editingId != null ? `${API}/${state.editingId}` : API;
    const method = state.editingId != null ? 'PUT' : 'POST';
    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok)
            throw new Error(await res.text());
        toast(state.editingId != null ? 'Transação atualizada!' : 'Transação criada!', 'success');
        closeModal();
        void loadTransactions();
    }
    catch (err) {
        toast('Erro ao salvar: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
    finally {
        btn.disabled = false;
        btn.textContent = 'Salvar';
    }
}
// ─── DELETE ───────────────────────────────────────────────────────────────────
async function deleteTransaction(id) {
    if (!confirm('Deseja remover esta transação?'))
        return;
    try {
        const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
        if (!res.ok)
            throw new Error(await res.text());
        toast('Transação removida', 'success');
        void loadTransactions();
    }
    catch (err) {
        toast('Erro ao remover: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
}
// ─── IMPORT / EXPORT ──────────────────────────────────────────────────────────
function setupImport() {
    const dropZone = getEl('dropZone');
    const fileInput = getEl('fileInput');
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const file = e.dataTransfer?.files[0];
        if (file)
            void uploadFile(file);
    });
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file)
            void uploadFile(file);
    });
}
async function uploadFile(file) {
    if (!file.name.endsWith('.xlsx')) {
        toast('Apenas arquivos .xlsx são suportados', 'error');
        return;
    }
    toast('Importando...', 'info');
    const formData = new FormData();
    formData.append('arquivo', file);
    try {
        const res = await fetch(`${API}/importar`, { method: 'POST', body: formData });
        const erros = (await res.json());
        toast(!erros || erros.length === 0 ? 'Importação concluída!' : `Importado com ${erros.length} aviso(s)`, !erros || erros.length === 0 ? 'success' : 'info');
        void loadTransactions();
    }
    catch (err) {
        toast('Erro na importação: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
}
async function exportarRelatorio() {
    try {
        const res = await fetch(`${API}/relatorio`);
        if (!res.ok)
            throw new Error(await res.text());
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cashly-relatorio-${new Date().toISOString().split('T')[0]}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    }
    catch (err) {
        toast('Erro ao exportar: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
}
// ─── SKELETONS ────────────────────────────────────────────────────────────────
function showSkeletons() {
    getEl('transacoesTbody').innerHTML = Array.from({ length: 8 }, () => `<tr>${Array.from({ length: 9 }, () => `<td><div class="skeleton" style="width:${60 + Math.random() * 60}%"></div></td>`).join('')}</tr>`).join('');
}
// ─── TOAST ────────────────────────────────────────────────────────────────────
function toast(msg, type = 'info') {
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type]}</span> ${msg}`;
    getEl('toastContainer').appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; }, 3500);
    setTimeout(() => { el.remove(); }, 3800);
}
// ─── HELPERS ──────────────────────────────────────────────────────────────────
function formatMoney(v) {
    return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDate(d) {
    if (!d)
        return '—';
    const parts = d.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
}
// Expor globalmente as funções chamadas via onclick no HTML
window.sortBy = sortBy;
window.editTransaction = editTransaction;
window.deleteTransaction = deleteTransaction;
window.exportarRelatorio = exportarRelatorio;
window.toggleAIPanel = toggleAIPanel;
window.enviarMsgIA = enviarMsgIA;
window.classificarPendentes = classificarPendentes;
window.startVoiceTransaction = startVoiceTransaction;
window.cancelVoice = cancelVoice;
window.toggleMicAI = toggleMicAI;
window.loadTransactions = loadTransactions;
// ─── AI AGENT PANEL ───────────────────────────────────────────────────────────
let aiPanelOpen = false;
function toggleAIPanel() {
    const panel = document.getElementById('aiPanel');
    const backdrop = document.getElementById('aiBackdrop');
    const btn = document.getElementById('btnAI');
    aiPanelOpen = !aiPanelOpen;
    panel.classList.toggle('open', aiPanelOpen);
    backdrop.classList.toggle('open', aiPanelOpen);
    btn.classList.toggle('active', aiPanelOpen);
}
function addAIMessage(text, role, isThinking = false) {
    const container = document.getElementById('aiMessages');
    const msg = document.createElement('div');
    msg.className = `ai-msg ${role === 'user' ? 'ai-msg-user' : ''}`;
    const avatar = document.createElement('div');
    avatar.className = `ai-avatar ${role === 'user' ? 'ai-avatar-user' : ''}`;
    avatar.textContent = role === 'user' ? '👤' : '✦';
    const bubble = document.createElement('div');
    if (isThinking) {
        bubble.className = 'ai-bubble ai-bubble-thinking';
        bubble.innerHTML = '<div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div>';
    }
    else {
        bubble.className = 'ai-bubble';
        bubble.innerHTML = text;
    }
    if (role === 'user') {
        msg.appendChild(bubble);
        msg.appendChild(avatar);
    }
    else {
        msg.appendChild(avatar);
        msg.appendChild(bubble);
    }
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    return msg;
}
async function enviarMsgIA() {
    const input = document.getElementById('aiInput');
    const sendBtn = document.querySelector('.ai-send-btn');
    const text = input.value.trim();
    if (!text)
        return;
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
            addAIMessage(`Categoria identificada: <strong style="color:var(--ai-purple)">${categoria}</strong><br>
                <span style="color:var(--text-muted);font-size:12px">Confiança baseada na descrição fornecida.</span>`, 'bot');
        }
        else {
            addAIMessage('Não consegui classificar essa transação. Tente uma descrição mais detalhada.', 'bot');
        }
    }
    catch {
        thinkingMsg.remove();
        addAIMessage('Agente IA indisponível no momento. Verifique se o serviço está rodando na porta 8001.', 'bot');
    }
    finally {
        sendBtn.disabled = false;
        input.focus();
    }
}
// ─── RECONHECIMENTO DE VOZ ────────────────────────────────────────────────────
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
let activeRecognition = null;
let micTarget = null;
function isSpeechSupported() {
    return !!SpeechRecognitionAPI;
}
function buildRecognition() {
    const rec = new SpeechRecognitionAPI();
    rec.lang = 'pt-BR';
    rec.continuous = false;
    rec.interimResults = true;
    return rec;
}
function stopAllMics() {
    if (activeRecognition) {
        activeRecognition.abort();
        activeRecognition = null;
    }
    micTarget = null;
    document.querySelectorAll('.btn-mic, .ai-mic-btn').forEach((b) => {
        b.classList.remove('recording', 'error');
    });
    const fab = document.getElementById('voiceFab');
    if (fab)
        fab.classList.remove('recording');
}
// ── Mic no campo Descrição do modal ──────────────────────────────────────────
function setupMicDescricao() {
    const btn = document.getElementById('btnMicDescricao');
    if (!btn)
        return;
    if (!isSpeechSupported()) {
        btn.style.display = 'none';
        return;
    }
    btn.addEventListener('click', toggleMicDescricao);
}
function toggleMicDescricao() {
    if (activeRecognition && micTarget === 'descricao') {
        stopAllMics();
        return;
    }
    if (!isSpeechSupported()) {
        toast('Reconhecimento de voz não suportado neste navegador', 'error');
        return;
    }
    stopAllMics();
    micTarget = 'descricao';
    const btn = document.getElementById('btnMicDescricao');
    const input = document.getElementById('inputDescricao');
    activeRecognition = buildRecognition();
    btn.classList.add('recording');
    activeRecognition.onresult = (e) => {
        const transcript = Array.from(e.results)
            .map((r) => r[0].transcript)
            .join('');
        input.value = transcript;
    };
    activeRecognition.onend = () => {
        btn.classList.remove('recording');
        micTarget = null;
        activeRecognition = null;
    };
    activeRecognition.onerror = (e) => {
        btn.classList.remove('recording');
        btn.classList.add('error');
        setTimeout(() => btn.classList.remove('error'), 2000);
        micTarget = null;
        activeRecognition = null;
        if (e.error !== 'aborted')
            toast('Microfone indisponível: ' + e.error, 'error');
    };
    activeRecognition.start();
}
// ── Mic no painel de IA ───────────────────────────────────────────────────────
function toggleMicAI() {
    if (activeRecognition && micTarget === 'ai') {
        stopAllMics();
        return;
    }
    if (!isSpeechSupported()) {
        toast('Reconhecimento de voz não suportado neste navegador', 'error');
        return;
    }
    stopAllMics();
    micTarget = 'ai';
    const btn = document.getElementById('btnMicAI');
    const input = document.getElementById('aiInput');
    activeRecognition = buildRecognition();
    btn.classList.add('recording');
    input.value = '';
    input.placeholder = 'Ouvindo...';
    activeRecognition.onresult = (e) => {
        const transcript = Array.from(e.results)
            .map((r) => r[0].transcript)
            .join('');
        input.value = transcript;
    };
    activeRecognition.onend = () => {
        btn.classList.remove('recording');
        input.placeholder = 'Descreva ou fale uma transação...';
        micTarget = null;
        activeRecognition = null;
        if (input.value.trim())
            void enviarMsgIA();
    };
    activeRecognition.onerror = (e) => {
        btn.classList.remove('recording');
        btn.classList.add('error');
        input.placeholder = 'Descreva ou fale uma transação...';
        setTimeout(() => btn.classList.remove('error'), 2000);
        micTarget = null;
        activeRecognition = null;
        if (e.error !== 'aborted')
            toast('Microfone indisponível: ' + e.error, 'error');
    };
    activeRecognition.start();
}
// ── FAB: captura completa de transação por voz ────────────────────────────────
function startVoiceTransaction() {
    if (!isSpeechSupported()) {
        toast('Reconhecimento de voz não suportado neste navegador. Use Chrome ou Edge.', 'error');
        return;
    }
    if (activeRecognition && micTarget === 'voice') {
        stopAllMics();
        closeVoiceModal();
        return;
    }
    stopAllMics();
    micTarget = 'voice';
    const modal = document.getElementById('voiceModal');
    const status = document.getElementById('voiceStatus');
    const transcript = document.getElementById('voiceTranscript');
    const fab = document.getElementById('voiceFab');
    modal.classList.add('open');
    fab.classList.add('recording');
    status.textContent = 'Ouvindo... diga a transação';
    transcript.textContent = '';
    activeRecognition = buildRecognition();
    activeRecognition.onresult = (e) => {
        const text = Array.from(e.results)
            .map((r) => r[0].transcript)
            .join('');
        transcript.textContent = '"' + text + '"';
    };
    activeRecognition.onend = () => {
        const capturedText = transcript.textContent?.replace(/^"|"$/g, '').trim() || '';
        closeVoiceModal();
        micTarget = null;
        activeRecognition = null;
        if (capturedText)
            processVoiceCommand(capturedText);
    };
    activeRecognition.onerror = (e) => {
        closeVoiceModal();
        micTarget = null;
        activeRecognition = null;
        if (e.error !== 'aborted')
            toast('Erro no microfone: ' + e.error, 'error');
    };
    activeRecognition.start();
}
function cancelVoice() {
    stopAllMics();
    closeVoiceModal();
}
function closeVoiceModal() {
    const modal = document.getElementById('voiceModal');
    if (modal)
        modal.classList.remove('open');
    const fab = document.getElementById('voiceFab');
    if (fab)
        fab.classList.remove('recording');
}
// ── Parser de comandos de voz ─────────────────────────────────────────────────
function processVoiceCommand(text) {
    const lower = text.toLowerCase().trim();
    let tipo = 'SAIDA';
    if (/recebi|entrada|ganhei|salário|salario|depósito|deposito|pix recebi|transferência recebi/.test(lower)) {
        tipo = 'ENTRADA';
    }
    let valor = null;
    const valorMatch = lower.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:reais?|real|r\$)?/);
    if (valorMatch) {
        valor = parseFloat(valorMatch[1].replace(',', '.'));
    }
    let descricao = text;
    const preposMatch = lower.match(/(?:\bem\b|\bno\b|\bna\b|\bcom\b|\bde\b|\bpara\b)\s+(.+)$/);
    if (preposMatch) {
        descricao = preposMatch[1].charAt(0).toUpperCase() + preposMatch[1].slice(1);
    }
    openModalNew();
    (getEl('inputTipo')).value = tipo;
    if (valor !== null) {
        (getEl('inputValor')).value = String(valor);
    }
    (getEl('inputDescricao')).value = descricao;
    const valorStr = valor !== null ? `R$ ${formatMoney(valor)}` : 'valor não detectado';
    toast(`Voz: ${tipo} · ${valorStr} · "${descricao}"`, 'info');
}
async function classificarPendentes() {
    const thinkingMsg = addAIMessage('', 'bot', true);
    const sendBtn = document.querySelector('.ai-send-btn');
    sendBtn.disabled = true;
    try {
        const res = await fetch('/api/pagamentos/ai/classify-pending', { method: 'POST' });
        thinkingMsg.remove();
        if (res.ok) {
            const data = await res.json();
            const count = data.classified ?? data.count ?? '?';
            addAIMessage(`✅ <strong>${count}</strong> transações classificadas com sucesso!<br>
                <span style="color:var(--text-muted);font-size:12px">Atualize a tabela para ver as categorias.</span><br>
                <button class="btn-ai-action" onclick="loadTransactions()">↻ Atualizar tabela</button>`, 'bot');
            await loadTransactions();
        }
        else {
            addAIMessage('Nenhuma transação pendente encontrada ou erro na classificação.', 'bot');
        }
    }
    catch {
        thinkingMsg.remove();
        addAIMessage('Agente IA indisponível. Verifique se o serviço está rodando na porta 8001.', 'bot');
    }
    finally {
        sendBtn.disabled = false;
    }
}
