-- Migration: create transacoes table
-- Corresponds to com.planilhaautomatizada.rest.model.TransactionEntity

CREATE TABLE IF NOT EXISTS transacoes (
    id              BIGSERIAL       PRIMARY KEY,
    tipo            VARCHAR(10)     NOT NULL,           -- ENTRADA | SAIDA
    valor           NUMERIC(19, 2)  NOT NULL,
    data            DATE,
    descricao       VARCHAR(255),
    categoria       VARCHAR(255),
    status_ia       VARCHAR(20)     NOT NULL DEFAULT 'PENDENTE',   -- PENDENTE | CATEGORIZADO | REVISADO
    status_pagamento VARCHAR(20)    NOT NULL DEFAULT 'PENDENTE',   -- PENDENTE | PAGO | CANCELADO
    origem          VARCHAR(255)
);
