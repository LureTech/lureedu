# Sobe o AssessoriaLure:
#   backend (Java / Spring Boot) em http://localhost:8085
#   frontend (Angular)           em http://localhost:4200
# Usa Java 21 e Node 24.15+ do sistema; se nao houver, baixa versoes portateis em .tools (nada e instalado no Windows).
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
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'
$logs = Join-Path $root 'logs'
New-Item -ItemType Directory -Force $tools, $logs | Out-Null

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Yellow }

function Test-Port($port) {
    return [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

function Get-JavaMajor($javaExe) {
    try {
        $out = & cmd /c "`"$javaExe`" -version 2>&1"
        if ("$out" -match 'version "(\d+)') { return [int]$Matches[1] }
    } catch {}
    return 0
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

# ---------- Java 21 ----------
$java = Join-Path $tools 'jdk\bin\java.exe'
if (-not (Test-Path $java)) {
    $sysJava = (Get-Command java -ErrorAction SilentlyContinue).Source
    if ($sysJava -and (Get-JavaMajor $sysJava) -ge 21) {
        $java = $sysJava
    } else {
        Expand-Download 'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse' 'jdk21.zip' 'jdk'
        $java = Join-Path $tools 'jdk\bin\java.exe'
    }
}
$env:JAVA_HOME = Split-Path -Parent (Split-Path -Parent $java)
Write-Step "Java: $java"

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
$env:PATH = "$nodeDir;$(Join-Path $env:JAVA_HOME 'bin');$env:PATH"
Write-Step "Node: $node ($(& $node --version))"

# ---------- Banco: Supabase (se houver supabase.env com a senha) ou H2 local ----------
$dbEnv = Join-Path $root 'supabase.env'
if (Test-Path $dbEnv) {
    $vars = @{}
    foreach ($line in Get-Content $dbEnv -Encoding UTF8) {
        $t = $line.Trim()
        if (-not $t -or $t.StartsWith('#') -or -not $t.Contains('=')) { continue }
        $i = $t.IndexOf('=')
        $vars[$t.Substring(0, $i).Trim()] = $t.Substring($i + 1).Trim()
    }
    if (-not $vars['DB_PASSWORD'] -or $vars['DB_PASSWORD'] -eq 'COLE_A_SENHA_DO_BANCO_AQUI') {
        Write-Host 'supabase.env sem a senha do banco (DB_PASSWORD): usando o banco local.' -ForegroundColor Red
    } else {
        foreach ($k in $vars.Keys) { Set-Item -Path "Env:$k" -Value $vars[$k] }
        Write-Step 'Banco: Supabase (nuvem), configurado em supabase.env'
    }
} else {
    Write-Step 'Banco: local (H2 em backend\data)'
}

# ---------- Backend ----------
$jar = Join-Path $backend 'target\growth.jar'
if (Test-Port 8085) {
    Write-Step 'Backend ja esta rodando na porta 8085.'
} else {
    if (-not (Test-Path $jar)) {
        Write-Step 'Compilando o backend (so na primeira vez, alguns minutos)...'
        Push-Location $backend
        & cmd /c "mvnw.cmd -q -DskipTests package"
        $code = $LASTEXITCODE
        Pop-Location
        if ($code -ne 0) { throw 'Falha ao compilar o backend.' }
    }
    Write-Step 'Iniciando backend em http://localhost:8085 (log: logs\backend.log) ...'
    Start-Process -FilePath $java -ArgumentList '-jar', 'target\growth.jar' -WorkingDirectory $backend `
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
