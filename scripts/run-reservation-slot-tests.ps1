param()
$ErrorActionPreference='Stop'
$credential=Import-Clixml -LiteralPath (Join-Path $env:LOCALAPPDATA 'MirpanelTest\test-db.credential.xml')
if($credential.UserName -ne 'postgres.edbqjvggvkxbrwyrdbsd'){throw 'TEST_ACCOUNT_MISMATCH'}
$node='C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
try{
  $env:MIRPANEL_TEST_DB_PASSWORD=$credential.GetNetworkCredential().Password
  $env:MIRPANEL_REAL_TEST='1'
  & $node --use-system-ca (Join-Path $PSScriptRoot 'test-reservation-slot-rebalance-database.mjs')
  exit $LASTEXITCODE
}finally{
  Remove-Item Env:MIRPANEL_TEST_DB_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:MIRPANEL_REAL_TEST -ErrorAction SilentlyContinue
}
