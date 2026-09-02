param([switch]$RunQueueTests)
$ErrorActionPreference = 'Stop'
$testCredential = Import-Clixml -LiteralPath (Join-Path $env:LOCALAPPDATA 'MirpanelTest\test-db.credential.xml')
if ($testCredential.UserName -ne 'postgres.edbqjvggvkxbrwyrdbsd') { throw 'TEST_ACCOUNT_MISMATCH' }
$nodePath = 'C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
try {
    $env:MIRPANEL_TEST_DB_PASSWORD = $testCredential.GetNetworkCredential().Password
    if ($RunQueueTests) {
        $env:MIRPANEL_REAL_TEST='1'
        Push-Location (Split-Path $PSScriptRoot -Parent)
        try { & $nodePath --use-system-ca (Join-Path $PSScriptRoot 'test-four-card-queue-database.mjs') } finally { Pop-Location }
    } else { & $nodePath --use-system-ca (Join-Path $PSScriptRoot 'check-test-postgres.mjs') }
    $testExit = $LASTEXITCODE
} finally {
    Remove-Item Env:MIRPANEL_TEST_DB_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:MIRPANEL_REAL_TEST -ErrorAction SilentlyContinue
    Remove-Variable testCredential -ErrorAction SilentlyContinue
}
exit $testExit
