package com.planilhaautomatizada.rest.controller;

import com.planilhaautomatizada.rest.dto.PagamentoDTO;
import com.planilhaautomatizada.rest.dto.PagamentoResponseDTO;
import com.planilhaautomatizada.rest.service.PagamentoService;
import jakarta.validation.Valid;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;


@RestController
@RequestMapping("/api/pagamentos")
@RequiredArgsConstructor
@CrossOrigin(origins = "${app.cors.allowed-origins:*}")
public class Controller {

    private final PagamentoService pagamentoService;

    @PostMapping
    public ResponseEntity<PagamentoResponseDTO> criar(@Valid @RequestBody PagamentoDTO dto) {
        PagamentoResponseDTO response = pagamentoService.criar(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<PagamentoResponseDTO>> listar() {
        List<PagamentoResponseDTO> response = pagamentoService.listar();
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<PagamentoResponseDTO> buscarPorId(@PathVariable Long id) {
        PagamentoResponseDTO response = pagamentoService.buscarPorId(id);
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{id}")
    public ResponseEntity<PagamentoResponseDTO> atualizar(@PathVariable Long id, @Valid @RequestBody PagamentoDTO dto) {
        PagamentoResponseDTO response = pagamentoService.atualizar(id, dto);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletar(@PathVariable Long id) {
        pagamentoService.deletar(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/importar")
    public ResponseEntity<List<String>> importar(@RequestParam("arquivo") MultipartFile file) {
        List<String> erros = pagamentoService.importarArquivo(file);
        return ResponseEntity.ok(erros);
    }

    @GetMapping("/relatorio")
    public ResponseEntity<byte[]> relatorio() {
        byte[] planilha = pagamentoService.gerarRelatorio();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDisposition(ContentDisposition.attachment()
                .filename("relatorio.xlsx")
                .build());
        return ResponseEntity.ok().headers(headers).body(planilha);
    }

    @PostMapping("/ai/classify")
    public ResponseEntity<Map<String, String>> classifyDescription(@RequestBody Map<String, String> body) {
        String descricao = body.getOrDefault("descricao", "");
        String categoria = pagamentoService.classificarPorDescricao(descricao);
        return ResponseEntity.ok(Map.of("categoria", categoria));
    }

    @PostMapping("/ai/classify-pending")
    public ResponseEntity<Map<String, Integer>> classifyPending() {
        int count = pagamentoService.classificarPendentes();
        return ResponseEntity.ok(Map.of("classified", count));
    }
}
