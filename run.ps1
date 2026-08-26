# CourseCone launcher — native PowerShell, no bash needed
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot

function Free-Port([int]$port) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}

# --- find a Python that can import uvicorn ---
$py = $null
$candidates = @(@("python", @()), @("py", @("-3"))) +
    (Get-ChildItem "$env:LOCALAPPDATA\Programs\Python\Python3*\python.exe" -ErrorAction SilentlyContinue |
     ForEach-Object { @($_.FullName, @()) })

foreach ($c in $candidates) {
    $exe, $prefix = $c[0], $c[1]
    & $exe @prefix -c "import uvicorn" 2>$null
    if ($LASTEXITCODE -eq 0) { $py = @($exe) + $prefix; break }
}
if (-not $py) {
    Write-Host "ERROR: no Python with uvicorn found." -ForegroundColor Red
    Write-Host "Fix with:  pip install -r requirements.txt" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"; exit 1
}
Write-Host "Using: $($py -join ' ')" -ForegroundColor DarkGray

Write-Host "[1/1] Starting CourseCone -> http://localhost:8000" -ForegroundColor Cyan
Free-Port 8000
Start-Sleep -Milliseconds 300
Start-Process "http://localhost:8000"

try {
    $args = @()
    if ($py.Count -gt 2) { $args += $py[1..($py.Count-2)] }   # e.g. -3 for py launcher
    & $py[0] @args -m uvicorn app.main:app --port 8000
} finally {
    Free-Port 8000
}
