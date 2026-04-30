package com.planilhaautomatizada.rest.repository;

import com.planilhaautomatizada.rest.model.StatusIA;
import com.planilhaautomatizada.rest.model.TransactionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.math.BigDecimal;
import java.time.LocalDate;

@org.springframework.stereotype.Repository
public interface Repositorio extends JpaRepository<TransactionEntity, Long> {

    List<TransactionEntity> findByStatusIA(StatusIA statusIA);

    List<TransactionEntity> findByDataBetween(LocalDate dataInicio, LocalDate dataFim);

    boolean existsByValorAndDataAndDescricao(BigDecimal valor, LocalDate data, String descricao);
    
}

