package com.planilhaautomatizada.rest.dto;

import com.planilhaautomatizada.rest.model.StatusIA;
import com.planilhaautomatizada.rest.model.StatusPagamento;
import com.planilhaautomatizada.rest.model.TipoPagamento;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PagamentoResponseDTO(
        Long id,
        TipoPagamento tipo,
        BigDecimal valor,
        LocalDate data,
        String descricao,
        String categoria,
        StatusIA statusIA,
        StatusPagamento statusPagamento,
        String origem
) {}
