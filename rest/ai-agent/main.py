import json
import logging
import os
from enum import Enum
from typing import Optional

import google.generativeai as genai
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ─── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ─── API Key — carregada exclusivamente do .env, nunca hardcoded ───────────────
load_dotenv()

_GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
if not _GEMINI_API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY não configurada. "
        "Copie ai-agent/.env.example para ai-agent/.env e preencha sua chave."
    )

genai.configure(api_key=_GEMINI_API_KEY)

try:
    gemini_model = genai.GenerativeModel("gemini-2.0-flash")
    logger.info("Modelo Gemini inicializado com sucesso.")
except Exception as exc:
    raise RuntimeError(f"Falha ao inicializar o modelo Gemini: {exc}") from exc

# ─── App FastAPI ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="CASHLY — AI Agent",
    version="1.0.0",
    description="Microserviço de classificação automática de transações financeiras via Google Gemini",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080"],
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)

# ─── Categorias válidas ─────────────────────────────────────────────────────────
CATEGORIAS: list[str] = [
    "Alimentação", "Transporte", "Moradia", "Saúde", "Educação",
    "Lazer", "Vestuário", "Salário", "Investimento", "Transferência",
    "Serviços", "Impostos", "Outros",
]


# ─── Schemas ───────────────────────────────────────────────────────────────────
class TipoPagamento(str, Enum):
    ENTRADA = "ENTRADA"
    SAIDA = "SAIDA"


class StatusIA(str, Enum):
    PENDENTE = "PENDENTE"
    CATEGORIZADO = "CATEGORIZADO"
    REVISADO = "REVISADO"


class StatusPagamento(str, Enum):
    PENDENTE = "PENDENTE"
    PAGO = "PAGO"
    CANCELADO = "CANCELADO"


class TransactionRequest(BaseModel):
    id: Optional[int] = None
    tipo: TipoPagamento
    valor: float
    data: Optional[str] = None
    descricao: str
    categoria: Optional[str] = None
    statusIA: Optional[StatusIA] = StatusIA.PENDENTE
    origem: Optional[str] = None


class ClassificationResponse(BaseModel):
    id: Optional[int] = None
    categoria: str
    statusPagamento: StatusPagamento
    statusIA: StatusIA


# ─── Helpers ───────────────────────────────────────────────────────────────────
def _build_prompt(t: TransactionRequest) -> str:
    return (
        "Você é um agente financeiro especialista em transações bancárias brasileiras.\n"
        "Analise a transação abaixo e responda EXATAMENTE neste formato JSON (sem markdown, sem texto extra):\n\n"
        '{{"categoria": "<categoria>", "statusPagamento": "<PAGO, PENDENTE ou CANCELADO>"}}\n\n'
        f"Tipo: {t.tipo.value} (ENTRADA = receita, SAIDA = despesa)\n"
        f"Valor: R$ {t.valor:.2f}\n"
        f"Descrição: {t.descricao}\n"
        f"Origem: {t.origem or 'Não informada'}\n"
        f"Data: {t.data or 'Não informada'}\n\n"
        f"Categorias disponíveis: {', '.join(CATEGORIAS)}\n\n"
        "Regras:\n"
        "1. Use 'Salário' apenas se for ENTRADA com descrição indicando remuneração.\n"
        "2. Use 'Investimento' para aportes, resgates e dividendos.\n"
        "3. PAGO = concluído; PENDENTE = futuro/agendado; CANCELADO = estorno/devolução.\n\n"
        "Responda APENAS o JSON puro."
    )


def _parse_response(raw: str) -> dict:
    cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(cleaned)


# ─── Endpoints ─────────────────────────────────────────────────────────────────
@app.post("/classify", response_model=ClassificationResponse)
async def classify_transaction(transaction: TransactionRequest) -> ClassificationResponse:
    if transaction.statusIA == StatusIA.REVISADO:
        return ClassificationResponse(
            id=transaction.id,
            categoria=transaction.categoria or "Outros",
            statusPagamento=StatusPagamento.PENDENTE,
            statusIA=StatusIA.REVISADO,
        )

    prompt = _build_prompt(transaction)
    try:
        response = gemini_model.generate_content(prompt)
        data = _parse_response(response.text)

        categoria = data.get("categoria", "Outros")
        if categoria not in CATEGORIAS:
            categoria = "Outros"

        status_str = data.get("statusPagamento", "PENDENTE").upper()
        try:
            status_pagamento = StatusPagamento(status_str)
        except ValueError:
            status_pagamento = StatusPagamento.PENDENTE

        logger.info("Classificado id=%s → %s / %s", transaction.id, categoria, status_pagamento)
        return ClassificationResponse(
            id=transaction.id,
            categoria=categoria,
            statusPagamento=status_pagamento,
            statusIA=StatusIA.CATEGORIZADO,
        )
    except json.JSONDecodeError as exc:
        logger.error("Resposta inválida do Gemini: %s", exc)
        raise HTTPException(status_code=502, detail="Resposta inválida do Gemini — tente novamente.") from exc
    except Exception as exc:
        logger.error("Erro ao classificar transação: %s", exc)
        raise HTTPException(status_code=500, detail=f"Erro interno: {exc}") from exc


@app.post("/classify/batch", response_model=list[ClassificationResponse])
async def classify_batch(transactions: list[TransactionRequest]) -> list[ClassificationResponse]:
    results = []
    for transaction in transactions:
        result = await classify_transaction(transaction)
        results.append(result)
    return results


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "CASHLY AI Agent", "model": "gemini-2.0-flash"}


# ─── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ─── Configuração da API Key ────────────────────────────────────────────────────
# A chave é lida EXCLUSIVAMENTE do arquivo .env — nunca hardcoded no código
load_dotenv()

_GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
if not _GEMINI_API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY não configurada. "
        "Copie ai-agent/.env.example para ai-agent/.env e preencha sua chave."
    )

genai.configure(api_key=_GEMINI_API_KEY)

try:
    gemini_model = genai.GenerativeModel("gemini-2.0-flash")
    logger.info("Modelo Gemini inicializado com sucesso.")
except Exception as exc:
    raise RuntimeError(f"Falha ao inicializar o modelo Gemini: {exc}") from exc

# ─── App FastAPI ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="CASHLY — AI Agent",
    version="1.0.0",
    description="Microserviço de classificação automática de transações financeiras via Google Gemini",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080"],
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)

# ─── Categorias válidas ─────────────────────────────────────────────────────────
CATEGORIAS: list[str] = [
    "Alimentação", "Transporte", "Moradia", "Saúde", "Educação",
    "Lazer", "Vestuário", "Salário", "Investimento", "Transferência",
    "Serviços", "Impostos", "Outros",
]


# ─── Schemas ───────────────────────────────────────────────────────────────────
class TipoPagamento(str, Enum):
    ENTRADA = "ENTRADA"
    SAIDA = "SAIDA"


class StatusIA(str, Enum):
    PENDENTE = "PENDENTE"
    CATEGORIZADO = "CATEGORIZADO"
    REVISADO = "REVISADO"


class StatusPagamento(str, Enum):
    PENDENTE = "PENDENTE"
    PAGO = "PAGO"
    CANCELADO = "CANCELADO"


class TransactionRequest(BaseModel):
    id: Optional[int] = None
    tipo: TipoPagamento
    valor: float
    data: Optional[str] = None
    descricao: str
    categoria: Optional[str] = None
    statusIA: Optional[StatusIA] = StatusIA.PENDENTE
    origem: Optional[str] = None


class ClassificationResponse(BaseModel):
    id: Optional[int] = None
    categoria: str
    statusPagamento: StatusPagamento
    statusIA: StatusIA


# ─── Helpers ───────────────────────────────────────────────────────────────────
def _build_prompt(t: TransactionRequest) -> str:
    return (
        "Você é um agente financeiro especialista em transações bancárias brasileiras.\n"
        "Analise a transação abaixo e responda EXATAMENTE neste formato JSON (sem markdown, sem texto extra):\n\n"
        '{{"categoria": "<categoria>", "statusPagamento": "<PAGO, PENDENTE ou CANCELADO>"}}\n\n'
        f"Tipo: {t.tipo.value} (ENTRADA = receita, SAIDA = despesa)\n"
        f"Valor: R$ {t.valor:.2f}\n"
        f"Descrição: {t.descricao}\n"
        f"Origem: {t.origem or 'Não informada'}\n"
        f"Data: {t.data or 'Não informada'}\n\n"
        f"Categorias disponíveis: {', '.join(CATEGORIAS)}\n\n"
        "Regras:\n"
        "1. Use 'Salário' apenas se for ENTRADA com descrição indicando remuneração.\n"
        "2. Use 'Investimento' para aportes, resgates e dividendos.\n"
        "3. PAGO = concluído; PENDENTE = futuro/agendado; CANCELADO = estorno/devolução.\n\n"
        "Responda APENAS o JSON puro."
    )


def _parse_response(raw: str) -> dict:
    cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(cleaned)


# ─── Endpoints ─────────────────────────────────────────────────────────────────
@app.post("/classify", response_model=ClassificationResponse)
async def classify_transaction(transaction: TransactionRequest) -> ClassificationResponse:
    if transaction.statusIA == StatusIA.REVISADO:
        return ClassificationResponse(
            id=transaction.id,
            categoria=transaction.categoria or "Outros",
            statusPagamento=StatusPagamento.PENDENTE,
            statusIA=StatusIA.REVISADO,
        )

    prompt = _build_prompt(transaction)
    try:
        response = gemini_model.generate_content(prompt)
        data = _parse_response(response.text)

        categoria = data.get("categoria", "Outros")
        if categoria not in CATEGORIAS:
            categoria = "Outros"

        status_str = data.get("statusPagamento", "PENDENTE").upper()
        try:
            status_pagamento = StatusPagamento(status_str)
        except ValueError:
            status_pagamento = StatusPagamento.PENDENTE

        logger.info("Classificado id=%s → %s / %s", transaction.id, categoria, status_pagamento)
        return ClassificationResponse(
            id=transaction.id,
            categoria=categoria,
            statusPagamento=status_pagamento,
            statusIA=StatusIA.CATEGORIZADO,
        )
    except json.JSONDecodeError as exc:
        logger.error("Resposta inválida do Gemini: %s", exc)
        raise HTTPException(status_code=502, detail="Resposta inválida do Gemini — tente novamente.") from exc
    except Exception as exc:
        logger.error("Erro ao classificar transação: %s", exc)
        raise HTTPException(status_code=500, detail=f"Erro interno: {exc}") from exc


@app.post("/classify/batch", response_model=list[ClassificationResponse])
async def classify_batch(transactions: list[TransactionRequest]) -> list[ClassificationResponse]:
    results = []
    for transaction in transactions:
        result = await classify_transaction(transaction)
        results.append(result)
    return results


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "CASHLY AI Agent", "model": "gemini-2.0-flash"}


CATEGORIAS = [
    "Alimentação", "Transporte", "Moradia", "Saúde", "Educação",
    "Lazer", "Vestuário", "Salário", "Investimento", "Transferência",
    "Serviços", "Impostos", "Outros",
]


# ---------- Schemas ----------

class TipoPagamento(str, Enum):
    ENTRADA = "ENTRADA"
    SAIDA = "SAIDA"


class StatusIA(str, Enum):
    PENDENTE = "PENDENTE"
    CATEGORIZADO = "CATEGORIZADO"
    REVISADO = "REVISADO"


class StatusPagamento(str, Enum):
    PENDENTE = "PENDENTE"
    PAGO = "PAGO"
    CANCELADO = "CANCELADO"


class TransactionRequest(BaseModel):
    id: Optional[int] = None
    tipo: TipoPagamento
    valor: float
    data: Optional[str] = None
    descricao: str
    categoria: Optional[str] = None
    statusIA: Optional[StatusIA] = StatusIA.PENDENTE
    origem: Optional[str] = None


class ClassificationResponse(BaseModel):
    id: Optional[int] = None
    categoria: str
    statusPagamento: StatusPagamento
    statusIA: StatusIA


# ---------- Helpers ----------

def build_prompt(transaction: TransactionRequest) -> str:
    return f"""Você é um agente financeiro especialista em análise de transações bancárias brasileiras.
Analise a transação abaixo e responda EXATAMENTE neste formato JSON (sem markdown, sem texto extra):

{{
"categoria": "<uma das categorias listadas>",
"statusPagamento": "<PAGO, PENDENTE ou CANCELADO>"
}}

Transação:
- Tipo: {transaction.tipo.value} (ENTRADA = receita/crédito, SAIDA = despesa/débito)
- Valor: R$ {transaction.valor:.2f}
- Descrição: {transaction.descricao}
- Origem: {transaction.origem or "Não informada"}
- Data: {transaction.data or "Não informada"}

Categorias disponíveis: {", ".join(CATEGORIAS)}

Regras:
1. Use "Salário" apenas se for ENTRADA com descrição indicando remuneração.
2. Use "Investimento" para aportes, resgates e dividendos.
3. statusPagamento:
- PAGO → transação já concluída/confirmada
- PENDENTE → futura, agendada ou incerta
- CANCELADO → estorno, devolução ou cancelamento

Responda APENAS o JSON puro."""


def parse_gemini_response(raw: str) -> dict:
    cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(cleaned)


# ---------- Endpoints ----------

@app.post("/classify", response_model=ClassificationResponse)
async def classify_transaction(transaction: TransactionRequest) -> ClassificationResponse:
    # Não sobrescrever categorias revisadas pelo usuário
    if transaction.statusIA == StatusIA.REVISADO:
        return ClassificationResponse(
            id=transaction.id,
            categoria=transaction.categoria or "Outros",
            statusPagamento=StatusPagamento.PENDENTE,
            statusIA=StatusIA.REVISADO,
        )

    prompt = build_prompt(transaction)

    try:
        response = gemini_model.generate_content(prompt)
        data = parse_gemini_response(response.text)

        categoria = data.get("categoria", "Outros")
        if categoria not in CATEGORIAS:
            categoria = "Outros"

        status_str = data.get("statusPagamento", "PENDENTE").upper()
        try:
            status_pagamento = StatusPagamento(status_str)
        except ValueError:
            status_pagamento = StatusPagamento.PENDENTE

        return ClassificationResponse(
            id=transaction.id,
            categoria=categoria,
            statusPagamento=status_pagamento,
            statusIA=StatusIA.CATEGORIZADO,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar com Gemini: {str(e)}")


@app.post("/classify/batch", response_model=list[ClassificationResponse])
async def classify_batch(transactions: list[TransactionRequest]) -> list[ClassificationResponse]:
    results = []
    for transaction in transactions:
        result = await classify_transaction(transaction)
        results.append(result)
    return results


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "AI Agent - Planilha Automatizada"}
