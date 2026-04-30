package com.planilhaautomatizada.rest.service;

import com.planilhaautomatizada.rest.dto.AIClassificationResponse;
import com.planilhaautomatizada.rest.model.StatusIA;
import com.planilhaautomatizada.rest.model.TransactionEntity;
import com.planilhaautomatizada.rest.repository.Repositorio;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SchedulerService {

    private final Repositorio repositorio;
    private final AIClassifierService aiClassifierService;

    @Scheduled(fixedRateString = "${app.scheduler.interval-ms:3600000}")
    public void classificarPendentes() {
        List<TransactionEntity> pendentes = repositorio.findByStatusIA(StatusIA.PENDENTE);

        for (TransactionEntity entity : pendentes) {
            AIClassificationResponse resposta = aiClassifierService.classify(entity);
            if (resposta != null) {
                entity.setCategoria(resposta.categoria());
                entity.setStatusPagamento(resposta.statusPagamento());
                entity.setStatusIA(resposta.statusIA());
                repositorio.save(entity);
            }
        }
    }
}
