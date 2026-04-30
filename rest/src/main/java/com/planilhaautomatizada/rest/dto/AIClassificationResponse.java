package com.planilhaautomatizada.rest.dto;

import com.planilhaautomatizada.rest.model.StatusIA;
import com.planilhaautomatizada.rest.model.StatusPagamento;

public record AIClassificationResponse(
        Long id,
        String categoria,
        StatusPagamento statusPagamento,
        StatusIA statusIA
) {}
