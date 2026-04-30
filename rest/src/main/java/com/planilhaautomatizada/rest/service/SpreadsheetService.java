package com.planilhaautomatizada.rest.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.planilhaautomatizada.rest.dto.PagamentoDTO;
import com.planilhaautomatizada.rest.model.StatusIA;
import com.planilhaautomatizada.rest.model.TipoPagamento;
import com.planilhaautomatizada.rest.model.TransactionEntity;

@Service
public class SpreadsheetService {

    public List<PagamentoDTO> processSpreadsheet(MultipartFile file) {
        return lerArquivo(file);
    }

    private String getStringValue(Row row, int col) {
        Cell cell = row.getCell(col);
        if (cell == null) return "";
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue().trim();
            case NUMERIC -> String.valueOf((long) cell.getNumericCellValue());
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            default -> "";
        };
    }

    private List<PagamentoDTO> lerArquivo(MultipartFile file) {
        String nomeArquivo = file.getOriginalFilename();
        if (nomeArquivo == null || !nomeArquivo.endsWith(".xlsx")) {
            throw new IllegalArgumentException("Formato não suportado. Envie um arquivo .xlsx");
        }

        List<PagamentoDTO> pagamentos = new ArrayList<>();

        try (XSSFWorkbook workbook = new XSSFWorkbook(file.getInputStream())) {
            Sheet aba = workbook.getSheetAt(0);

            for (int i = 1; i <= aba.getLastRowNum(); i++) {
                Row linha = aba.getRow(i);
                if (linha == null) continue;

                String tipoStr = getStringValue(linha, 0).toUpperCase();
                if (tipoStr.isBlank()) continue;

                TipoPagamento tipo = TipoPagamento.valueOf(tipoStr);
                Cell celulaValor = linha.getCell(1);
                BigDecimal valor = celulaValor != null
                        ? BigDecimal.valueOf(celulaValor.getNumericCellValue())
                        : BigDecimal.ZERO;
                Cell celulaData = linha.getCell(2);
                LocalDate data = celulaData != null
                        ? celulaData.getLocalDateTimeCellValue().toLocalDate()
                        : LocalDate.now();
                String descricao = getStringValue(linha, 3);
                String categoria = getStringValue(linha, 4);
                String origem = getStringValue(linha, 5);

                pagamentos.add(new PagamentoDTO(tipo, valor, data, descricao, categoria, origem));
            }
        } catch (IOException e) {
            throw new RuntimeException("Erro ao ler o arquivo: " + e.getMessage(), e);
        }

        return pagamentos;
    }

    public byte[] gerarPlanilha(List<TransactionEntity> transacoes, Map<String, Object> resumo) {
        try (XSSFWorkbook workbook = new XSSFWorkbook();
            ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            // Estilo amarelo para PENDENTE
            CellStyle estiloPendente = workbook.createCellStyle();
            estiloPendente.setFillForegroundColor(IndexedColors.YELLOW.getIndex());
            estiloPendente.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            // Aba "Pagamentos"
            Sheet abaPagamentos = workbook.createSheet("Pagamentos");
            Row cabecalho = abaPagamentos.createRow(0);
            String[] colunas = {"ID", "Tipo", "Valor", "Data", "Descrição", "Categoria", "Status IA", "Status Pagamento", "Origem"};
            for (int i = 0; i < colunas.length; i++) {
                cabecalho.createCell(i).setCellValue(colunas[i]);
            }

            int rowIdx = 1;
            for (TransactionEntity t : transacoes) {
                Row linha = abaPagamentos.createRow(rowIdx++);
                boolean pendente = t.getStatusIA() == StatusIA.PENDENTE;

                Cell[] cells = {
                    linha.createCell(0), linha.createCell(1), linha.createCell(2),
                    linha.createCell(3), linha.createCell(4), linha.createCell(5),
                    linha.createCell(6), linha.createCell(7), linha.createCell(8)
                };
                cells[0].setCellValue(t.getId());
                cells[1].setCellValue(t.getTipo() != null ? t.getTipo().name() : "");
                cells[2].setCellValue(t.getValor() != null ? t.getValor().doubleValue() : 0);
                cells[3].setCellValue(t.getData() != null ? t.getData().toString() : "");
                cells[4].setCellValue(t.getDescricao() != null ? t.getDescricao() : "");
                cells[5].setCellValue(t.getCategoria() != null ? t.getCategoria() : "");
                cells[6].setCellValue(t.getStatusIA() != null ? t.getStatusIA().name() : "");
                cells[7].setCellValue(t.getStatusPagamento() != null ? t.getStatusPagamento().name() : "");
                cells[8].setCellValue(t.getOrigem() != null ? t.getOrigem() : "");

                if (pendente) {
                    for (Cell cell : cells) {
                        cell.setCellStyle(estiloPendente);
                    }
                }
            }

            // Aba "Resumo"
            Sheet abaResumo = workbook.createSheet("Resumo");
            Row cabecalhoResumo = abaResumo.createRow(0);
            cabecalhoResumo.createCell(0).setCellValue("Categoria");
            cabecalhoResumo.createCell(1).setCellValue("Total");

            int resumoIdx = 1;
            for (Map.Entry<String, Object> entry : resumo.entrySet()) {
                Row linhaResumo = abaResumo.createRow(resumoIdx++);
                linhaResumo.createCell(0).setCellValue(entry.getKey());
                linhaResumo.createCell(1).setCellValue(entry.getValue() != null ? entry.getValue().toString() : "");
            }

            workbook.write(out);
            return out.toByteArray();

        } catch (IOException e) {
            throw new RuntimeException("Erro ao gerar planilha: " + e.getMessage(), e);
        }
    }

}