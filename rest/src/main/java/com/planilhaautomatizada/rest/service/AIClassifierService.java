package com.planilhaautomatizada.rest.service;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import com.planilhaautomatizada.rest.dto.AIClassificationResponse;
import com.planilhaautomatizada.rest.model.StatusIA;
import com.planilhaautomatizada.rest.model.TransactionEntity;

@Service
public class AIClassifierService {

    @Value("${ai.agent.url:http://localhost:8001}")
    private String aiAgentUrl;

    private RestClient restClient;

    @PostConstruct
    void init() {
        this.restClient = RestClient.builder().baseUrl(aiAgentUrl).build();
    }

    
    public AIClassificationResponse classify(TransactionEntity transaction) {
        if (transaction.getStatusIA() == StatusIA.REVISADO) {
            return null;
        }

        var request = new AIClassifyRequest(
                transaction.getId(),
                transaction.getTipo().name(),
                transaction.getValor().doubleValue(),
                transaction.getData() != null ? transaction.getData().toString() : null,
                transaction.getDescricao(),
                transaction.getCategoria(),
                transaction.getStatusIA() != null ? transaction.getStatusIA().name() : "PENDENTE",
                transaction.getOrigem()
        );

        try {
            return restClient.post()
                    .uri("/classify")
                    .body(request)
                    .retrieve()
                    .body(AIClassificationResponse.class);
        } catch (Exception e) {
            return null;
        }
    }

    private record AIClassifyRequest(
            Long id,
            String tipo,
            double valor,
            String data,
            String descricao,
            String categoria,
            String statusIA,
            String origem
    ) {}
}

