package com.planilhaautomatizada.rest.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import com.planilhaautomatizada.rest.model.TipoPagamento;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PagamentoDTO(
        @NotNull TipoPagamento tipo,
        @NotNull @Positive BigDecimal valor,
        @NotNull LocalDate data,
        @NotBlank String descricao,
        String categoria,
        String origem
        
) {}
