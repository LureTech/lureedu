# Publica o AssessoriaLure (site + API) num projeto da Vercel da conta logada neste computador.
# Cria o projeto se nao existir, copia DB_URL/DB_USERNAME/DB_PASSWORD do supabase.env para as
# variaveis do projeto (sem mostrar na tela), gera um JWT_SECRET novo e publica em producao.
#
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\publicar-vercel.ps1
#       (opcional: -Scope <time da Vercel>  -Project <nome do projeto>)
param(
    [string]$Scope = 'suporte-4552s-projects',
    [string]$Project = 'lureedu'
)

# 'Continue': o CLI da Vercel escreve o progresso no stderr, e com 'Stop' o PowerShell 5 trata isso
# como erro fatal. As falhas de verdade são conferidas pelo $LASTEXITCODE.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Yellow }

# O vinculo desta pasta com a Vercel fica em .vercel; guardamos o anterior para restaurar no fim.
$linkBackup = $null
if (Test-Path '.vercel\project.json') {
    $linkBackup = Get-Content '.vercel\project.json' -Raw
}

function Add-Env($name, $value) {
    foreach ($target in 'production', 'preview') {
        & vercel env rm $name $target -y --scope $Scope 2>$null | Out-Null
        $value | & vercel env add $name $target --scope $Scope 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Nao consegui gravar $name ($target) na Vercel." }
    }
    Write-Host "    $name ok"
}

try {
    Write-Step "Criando/vinculando o projeto '$Project' no time '$Scope'..."
    & vercel link --project $Project --scope $Scope --yes
    if ($LASTEXITCODE -ne 0) { throw 'Nao consegui criar/vincular o projeto na Vercel.' }
    if (-not (Test-Path 'supabase.env')) { throw 'Falta o arquivo supabase.env na pasta do projeto.' }

    Write-Step 'Copiando os dados do banco do supabase.env (valores nao aparecem na tela)...'
    $vars = @{}
    foreach ($line in Get-Content 'supabase.env' -Encoding UTF8) {
        $t = $line.Trim()
        if (-not $t -or $t.StartsWith('#') -or -not $t.Contains('=')) { continue }
        $i = $t.IndexOf('=')
        $vars[$t.Substring(0, $i).Trim()] = $t.Substring($i + 1).Trim()
    }
    foreach ($k in 'DB_URL', 'DB_USERNAME', 'DB_PASSWORD') {
        if (-not $vars[$k]) { throw "supabase.env sem $k." }
        Add-Env $k $vars[$k]
    }
    $bytes = New-Object byte[] 48
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    Add-Env 'JWT_SECRET' ([Convert]::ToBase64String($bytes))

    Write-Step 'Publicando (build do site + API, leva 1-2 minutos)...'
    $url = (& vercel deploy --prod --yes --scope $Scope 2>$null | Select-Object -Last 1).Trim()
    if ($url -notmatch '^https://') { throw 'O deploy falhou. Rode "vercel deploy --prod" para ver o erro.' }

    # Endereco fixo do projeto (ex.: https://lureedu-xyz.vercel.app), usado no link de "esqueci a senha" e no Face ID.
    $aliases = (& vercel inspect $url --scope $Scope 2>&1 | Out-String) |
        Select-String -Pattern 'https://[a-z0-9-]+\.vercel\.app' -AllMatches |
        ForEach-Object { $_.Matches.Value } | Sort-Object Length -Unique
    $site = if ($aliases) { $aliases[0] } else { $url }
    $domain = ([Uri]$site).Host
    Write-Step "Endereco do site: $site"
    Add-Env 'APP_FRONTEND_URL' $site
    Add-Env 'WEBAUTHN_RP_ID' $domain

    Write-Step 'Publicando de novo com o endereco final...'
    & vercel deploy --prod --yes --scope $Scope 2>$null | Out-Null

    Write-Step 'Testando o login pela API publicada...'
    $status = try {
        (Invoke-WebRequest -UseBasicParsing -Method Post -ContentType 'application/json' `
            -Body '{"email":"x@x.com","password":"senha-errada","rememberMe":false}' "$site/api/auth/login").StatusCode
    } catch { [int]$_.Exception.Response.StatusCode }
    if ($status -eq 401) {
        Write-Host ''
        Write-Host "  Pronto! AssessoriaLure no ar: $site" -ForegroundColor Green
    } else {
        Write-Host "  Publicado em $site, mas a API respondeu $status no teste de login. Veja os logs: vercel logs $site" -ForegroundColor Red
    }
} finally {
    if ($linkBackup) {
        Set-Content -Path '.vercel\project.json' -Value $linkBackup -NoNewline
    }
}
