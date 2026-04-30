package com.planilhaautomatizada.rest.service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.planilhaautomatizada.rest.dto.AIClassificationResponse;
import com.planilhaautomatizada.rest.dto.PagamentoDTO;
import com.planilhaautomatizada.rest.dto.PagamentoResponseDTO;
import com.planilhaautomatizada.rest.model.StatusIA;
import com.planilhaautomatizada.rest.model.TipoPagamento;
import com.planilhaautomatizada.rest.model.TransactionEntity;
import com.planilhaautomatizada.rest.repository.Repositorio;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PagamentoService {

    private final Repositorio repositorio;
    private final SpreadsheetService spreadsheetService;
    private final AIClassifierService aiClassifierService;

    @Transactional
    public PagamentoResponseDTO criar(PagamentoDTO dto) {
        TransactionEntity entity = new TransactionEntity();
        entity.setTipo(dto.tipo());
        entity.setValor(dto.valor());
        entity.setData(dto.data());
        entity.setDescricao(dto.descricao());
        entity.setCategoria(dto.categoria());
        entity.setOrigem(dto.origem());
        TransactionEntity salvo = repositorio.save(entity);
        classificar(salvo);
        return toResponse(salvo);
    }

    public List<PagamentoResponseDTO> listar() {
        return repositorio.findAll().stream().map(this::toResponse).toList();
    }

    public PagamentoResponseDTO buscarPorId(Long id) {
        return repositorio.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new RuntimeException("Pagamento não encontrado: " + id));
    }

    @Transactional
    public PagamentoResponseDTO atualizar(Long id, PagamentoDTO dto) {
        TransactionEntity entity = repositorio.findById(id)
                .orElseThrow(() -> new RuntimeException("Pagamento não encontrado: " + id));
        entity.setTipo(dto.tipo());
        entity.setValor(dto.valor());
        entity.setData(dto.data());
        entity.setDescricao(dto.descricao());
        entity.setCategoria(dto.categoria());
        entity.setOrigem(dto.origem());
        return toResponse(repositorio.save(entity));
    }

    public void deletar(Long id) {
        if (!repositorio.existsById(id)) {
            throw new RuntimeException("Pagamento não encontrado: " + id);
        }
        repositorio.deleteById(id);
    }

    @Transactional
    public List<String> importarArquivo(MultipartFile file) {
        List<PagamentoDTO> dtos = spreadsheetService.processSpreadsheet(file);
        List<String> erros = new ArrayList<>();

        for (PagamentoDTO dto : dtos) {
            try {
                boolean duplicata = repositorio.existsByValorAndDataAndDescricao(
                        dto.valor(), dto.data(), dto.descricao());
                if (duplicata) {
                    erros.add("Duplicata ignorada: " + dto.descricao() + " em " + dto.data());
                    continue;
                }

                TransactionEntity entity = new TransactionEntity();
                entity.setTipo(dto.tipo());
                entity.setValor(dto.valor());
                entity.setData(dto.data());
                entity.setDescricao(dto.descricao());
                entity.setCategoria(dto.categoria());
                entity.setOrigem(dto.origem());
                TransactionEntity salvo = repositorio.save(entity);
                classificar(salvo);
            } catch (Exception e) {
                erros.add("Erro ao processar linha: " + dto.descricao() + " — " + e.getMessage());
            }
        }

        return erros;
    }

    public byte[] gerarRelatorio() {
        List<TransactionEntity> transacoes = repositorio.findAll();

        Map<String, BigDecimal> totaisPorCategoria = new HashMap<>();
        for (TransactionEntity t : transacoes) {
            String categoria = t.getCategoria() != null ? t.getCategoria() : "Sem categoria";
            totaisPorCategoria.merge(categoria, t.getValor() != null ? t.getValor() : BigDecimal.ZERO, BigDecimal::add);
        }

        Map<String, Object> resumo = new HashMap<>(totaisPorCategoria);
        return spreadsheetService.gerarPlanilha(transacoes, resumo);
    }

    private void classificar(TransactionEntity entity) {
        AIClassificationResponse resposta = aiClassifierService.classify(entity);
        if (resposta != null) {
            entity.setCategoria(resposta.categoria());
            entity.setStatusPagamento(resposta.statusPagamento());
            entity.setStatusIA(resposta.statusIA());
            repositorio.save(entity);
        }
    }

    public String classificarPorDescricao(String descricao) {
        TransactionEntity temp = new TransactionEntity();
        temp.setDescricao(descricao);
        temp.setTipo(TipoPagamento.SAIDA);
        temp.setValor(BigDecimal.ZERO);
        AIClassificationResponse resposta = aiClassifierService.classify(temp);
        if (resposta != null && resposta.categoria() != null) {
            return resposta.categoria();
        }
        return "Indefinida";
    }

    @Transactional
    public int classificarPendentes() {
        List<TransactionEntity> pendentes = repositorio.findAll().stream()
                .filter(e -> e.getStatusIA() == null || e.getStatusIA() == StatusIA.PENDENTE)
                .toList();
        int count = 0;
        for (TransactionEntity entity : pendentes) {
            AIClassificationResponse resposta = aiClassifierService.classify(entity);
            if (resposta != null) {
                entity.setCategoria(resposta.categoria());
                entity.setStatusPagamento(resposta.statusPagamento());
                entity.setStatusIA(resposta.statusIA());
                repositorio.save(entity);
                count++;
            }
        }
        return count;
    }

    private PagamentoResponseDTO toResponse(TransactionEntity e) {
        return new PagamentoResponseDTO(
                e.getId(), e.getTipo(), e.getValor(), e.getData(),
                e.getDescricao(), e.getCategoria(), e.getStatusIA(),
                e.getStatusPagamento(), e.getOrigem());
    }
}




