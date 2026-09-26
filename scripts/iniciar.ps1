# Sobe o AssessoriaLure:
#   API (TypeScript, a mesma da Vercel) em http://localhost:8085
#   frontend (Angular)           em http://localhost:4200
# Usa o Node 24.15+ do sistema; se nao houver, baixa uma versao portatil em .tools (nada e instalado no Windows).
#
# Por padrao o site sobe otimizado (modo producao): demora ~20s a mais para iniciar, mas abre e
# troca de tela muito mais rapido no navegador. Use -Dev para o modo de desenvolvimento, que
# recompila na hora a cada alteracao de codigo (bom para programar, lento para usar).
param([switch]$NoBrowser, [switch]$Dev)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root = Split-Path -Parent $PSScriptRoot
$tools = Join-Path $root '.tools'
$frontend = Join-Path $root 'frontend'
$logs = Join-Path $root 'logs'
New-Item -ItemType Directory -Force $tools, $logs | Out-Null

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Yellow }

function Test-Port($port) {
    return [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

function Get-NodeVersion($nodeExe) {
    try { return [version]((& $nodeExe --version).TrimStart('v')) } catch { return [version]'0.0.0' }
}

function Expand-Download($url, $zipName, $targetName) {
    $zip = Join-Path $tools $zipName
    Write-Step "Baixando $zipName (so na primeira vez)..."
    Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
    $tmp = Join-Path $tools "_extract"
    if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
    Expand-Archive -Path $zip -DestinationPath $tmp
    $inner = Get-ChildItem $tmp -Directory | Select-Object -First 1
    Move-Item $inner.FullName (Join-Path $tools $targetName)
    Remove-Item -Recurse -Force $tmp, $zip
}

# ---------- Node 24.15+ ----------
$node = Join-Path $tools 'node\node.exe'
if (-not (Test-Path $node)) {
    $sysNode = (Get-Command node -ErrorAction SilentlyContinue).Source
    if ($sysNode -and (Get-NodeVersion $sysNode) -ge [version]'24.15.0') {
        $node = $sysNode
    } else {
        Expand-Download 'https://nodejs.org/dist/v24.21.0/node-v24.21.0-win-x64.zip' 'node.zip' 'node'
        $node = Join-Path $tools 'node\node.exe'
    }
}
$nodeDir = Split-Path -Parent $node
$env:PATH = "$nodeDir;$env:PATH"
Write-Step "Node: $node ($(& $node --version))"

# ---------- Banco: Supabase (supabase.env com a senha) ----------
# A API (server/dev.ts) le o supabase.env sozinha; aqui so conferimos que ele existe.
$dbEnv = Join-Path $root 'supabase.env'
if (-not (Test-Path $dbEnv) -or -not (Select-String -Path $dbEnv -Pattern '^DB_PASSWORD=.+' -Quiet) -or
        (Select-String -Path $dbEnv -Pattern 'COLE_A_SENHA_DO_BANCO_AQUI' -Quiet)) {
    throw 'Falta a senha do banco em supabase.env (DB_PASSWORD). Veja Supabase -> Project Settings -> Database.'
}
Write-Step 'Banco: Supabase (nuvem), configurado em supabase.env'

# ---------- API (TypeScript, a mesma que roda na Vercel) ----------
if (Test-Port 8085) {
    Write-Step 'API ja esta rodando na porta 8085.'
} else {
    if (-not (Test-Path (Join-Path $root 'node_modules\tsx'))) {
        Write-Step 'Instalando dependencias da API (so na primeira vez)...'
        Push-Location $root
        & (Join-Path $nodeDir 'npm.cmd') install --no-audit --no-fund
        $code = $LASTEXITCODE
        Pop-Location
        if ($code -ne 0) { throw 'Falha no npm install da API.' }
    }
    Write-Step 'Iniciando API em http://localhost:8085 (log: logs\backend.log) ...'
    $env:API_PORT = '8085'
    Start-Process -FilePath $node -ArgumentList 'node_modules\tsx\dist\cli.mjs', 'server\dev.ts' -WorkingDirectory $root `
        -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'backend.log') -RedirectStandardError (Join-Path $logs 'backend-erros.log')
}

# ---------- Frontend ----------
if (Test-Port 4200) {
    Write-Step 'Frontend ja esta rodando na porta 4200.'
} else {
    if (-not (Test-Path (Join-Path $frontend 'node_modules'))) {
        Write-Step 'Instalando dependencias do frontend (so na primeira vez)...'
        Push-Location $frontend
        & (Join-Path $nodeDir 'npm.cmd') install --no-audit --no-fund
        $code = $LASTEXITCODE
        Pop-Location
        if ($code -ne 0) { throw 'Falha no npm install.' }
    }
    $modo = if ($Dev) { 'development' } else { 'production' }
    if ($Dev) {
        Write-Step 'Iniciando frontend em http://localhost:4200 - modo desenvolvimento (log: logs\frontend.log) ...'
    } else {
        Write-Step 'Iniciando frontend em http://localhost:4200 - otimizado, leva ~20s a mais (log: logs\frontend.log) ...'
    }
    Start-Process -FilePath $node -ArgumentList 'node_modules\@angular\cli\bin\ng.js', 'serve', '--configuration', $modo, '--port', '4200', '--no-open' -WorkingDirectory $frontend `
        -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'frontend.log') -RedirectStandardError (Join-Path $logs 'frontend-erros.log')
}

# ---------- Espera e abre o navegador ----------
function Wait-Http($url, $okCodes, $seconds) {
    $deadline = (Get-Date).AddSeconds($seconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
            if ($okCodes -contains [int]$r.StatusCode) { return $true }
        } catch {
            $resp = $_.Exception.Response
            if ($resp -and ($okCodes -contains [int]$resp.StatusCode)) { return $true }
        }
        Start-Sleep -Seconds 2
    }
    return $false
}

Write-Step 'Aguardando os servidores ficarem prontos...'
$apiOk = Wait-Http 'http://localhost:8085/api/sections' @(200, 401) 180
$webOk = Wait-Http 'http://localhost:4200/login' @(200) 180
if (-not ($apiOk -and $webOk)) {
    Write-Host "Algo nao subiu a tempo (API: $apiOk, site: $webOk). Veja os arquivos em $logs" -ForegroundColor Red
    exit 1
}

if (-not $NoBrowser) { Start-Process 'http://localhost:4200' }
Write-Host ''
Write-Host '  AssessoriaLure no ar: http://localhost:4200' -ForegroundColor Green
Write-Host '  Admin:  admin@lure.com.br  /  Lure@2026   (troque a senha no Perfil)'
Write-Host '  Aluno:  membro@lure.com.br /  Membro@2026'
Write-Host ''
Write-Host '  Os servidores continuam rodando em segundo plano. Para desligar: parar.cmd'
