# Teste do Leitor de Romaneio IA - Gemini Vision
$apiKey = "AIzaSyBDfeHy65U_yP6-l1ZY21Oi4s1NcnTyxIA"
$pdfPath = "C:\Users\Priscila\.gemini\antigravity\scratch\frigogest-2026\romaneio_teste.pdf"

Write-Host "=== TESTE: LEITOR DE ROMANEIO IA (GEMINI VISION) ===" -ForegroundColor Cyan
Write-Host "Arquivo: $pdfPath" -ForegroundColor Yellow

# Converter PDF para base64
$bytes = [System.IO.File]::ReadAllBytes($pdfPath)
$base64 = [System.Convert]::ToBase64String($bytes)
Write-Host "PDF convertido para base64 ($($bytes.Length) bytes)" -ForegroundColor Green

$prompt = @"
Voce eh um leitor especializado de romaneios de frigorifico brasileiro.
Analise este documento PDF e extraia TODOS os itens de pesagem.

Para cada animal/carcaca, identifique:
- Numero sequencial (seq)
- Tipo da peca: BANDA_A (traseiro esquerdo), BANDA_B (traseiro direito), ou INTEIRO
- Peso em kg com decimais

Retorne APENAS o JSON puro sem markdown:
[
  {"seq": 1, "tipo": "BANDA_A", "peso": 125.4},
  {"seq": 1, "tipo": "BANDA_B", "peso": 123.8}
]

Se tiver colunas "Esq" e "Dir" = BANDA_A e BANDA_B.
Nao inclua explicacoes. APENAS o array JSON.
"@

$body = @{
    contents = @(
        @{
            parts = @(
                @{ text = $prompt },
                @{ inlineData = @{ mimeType = "application/pdf"; data = $base64 } }
            )
        }
    )
} | ConvertTo-Json -Depth 10 -Compress

# Tentar diferentes modelos
$models = @("gemini-1.5-pro", "gemini-1.5-flash-latest", "gemini-2.0-flash", "gemini-2.0-flash-lite")

foreach ($model in $models) {
    Write-Host "`nTentando modelo: $model ..." -ForegroundColor Yellow
    $uri = "https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=$apiKey"
    
    try {
        $response = Invoke-RestMethod -Uri $uri -Method POST -ContentType "application/json" -Body $body -TimeoutSec 60
        $text = $response.candidates[0].content.parts[0].text
        
        Write-Host "=== SUCESSO COM MODELO: $model ===" -ForegroundColor Green
        Write-Host $text -ForegroundColor White
        
        # Parsear JSON
        $cleanText = ($text -replace '```json', '' -replace '```', '').Trim()
        try {
            $items = $cleanText | ConvertFrom-Json
            Write-Host "`n--- RESULTADO ---" -ForegroundColor Cyan
            Write-Host "Total de pecas: $($items.Count)" -ForegroundColor Green
            $items | Select-Object -First 10 | Format-Table -AutoSize
            $totalKg = ($items | Measure-Object -Property peso -Sum).Sum
            Write-Host "Peso total: $([math]::Round($totalKg, 2)) kg" -ForegroundColor Green
            $seqCount = ($items | Select-Object -ExpandProperty seq | Sort-Object -Unique).Count
            Write-Host "Numero de animais: $seqCount" -ForegroundColor Green
        } catch {
            Write-Host "JSON invalido mas IA respondeu. Veja resposta acima." -ForegroundColor Yellow
        }
        break  # Para no primeiro modelo que funcionar
        
    } catch {
        $err = $_.Exception.Message
        Write-Host "Falhou: $err" -ForegroundColor Red
    }
}
