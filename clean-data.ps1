# PowerShell script to clean queries and messages while preserving chat and report data
Write-Host "Starting database cleanup..." -ForegroundColor Cyan

# Clear queries
try {
    Write-Host "Clearing queries..." -ForegroundColor Yellow
    $queryResult = Invoke-RestMethod -Uri "http://localhost:3000/api/clear-queries" -Method DELETE
    Write-Host "Queries cleared successfully!" -ForegroundColor Green
    Write-Host $queryResult
} catch {
    Write-Host "Error clearing queries: $_" -ForegroundColor Red
}

# Clear messages
try {
    Write-Host "Clearing messages..." -ForegroundColor Yellow
    $messageResult = Invoke-RestMethod -Uri "http://localhost:3000/api/clear-messages" -Method DELETE
    Write-Host "Messages cleared successfully!" -ForegroundColor Green
    Write-Host $messageResult
} catch {
    Write-Host "Error clearing messages: $_" -ForegroundColor Red
}

# Verify chat archives are preserved
try {
    Write-Host "Verifying chat archives..." -ForegroundColor Yellow
    $chatResult = Invoke-RestMethod -Uri "http://localhost:3000/api/chat-archives" -Method GET
    Write-Host "Chat archives preserved: $(($chatResult | ConvertTo-Json -Depth 1).Length) records" -ForegroundColor Green
} catch {
    Write-Host "Error verifying chat archives: $_" -ForegroundColor Red
}

Write-Host "Cleanup complete!" -ForegroundColor Cyan
