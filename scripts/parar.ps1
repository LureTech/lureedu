# Desliga a API (porta 8085) e o frontend (porta 4200) do AssessoriaLure.
foreach ($port in 8085, 4200) {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($procId in ($conns | Select-Object -ExpandProperty OwningProcess -Unique)) {
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if ($proc -and @('java', 'node') -contains $proc.ProcessName) {
            Stop-Process -Id $procId -Force
            Write-Host "Porta ${port}: processo $($proc.ProcessName) ($procId) encerrado."
        } elseif ($proc) {
            Write-Host "Porta ${port}: ocupada por $($proc.ProcessName) ($procId) - nao e do LURE, deixei como esta."
        }
    }
}
