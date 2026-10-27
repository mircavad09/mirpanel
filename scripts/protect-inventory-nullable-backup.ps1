$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$backupRoot = Join-Path $env:LOCALAPPDATA 'MirpanelPrivateBackups'
$count = 0
foreach ($run in (Get-ChildItem -LiteralPath $backupRoot -Directory | Where-Object { $_.Name -like 'inventory-nullable-*' })) {
    $archive = Join-Path $run.FullName 'public.dump'
    if (-not (Test-Path -LiteralPath $archive)) { continue }
    $bytes = [System.IO.File]::ReadAllBytes($archive)
    $encryptedPath = $archive + '.dpapi'
    if (Test-Path -LiteralPath $encryptedPath) { throw 'Archive encryption target already exists' }
    $encrypted = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    [System.IO.File]::WriteAllBytes($encryptedPath, $encrypted)
    $restored = [System.Security.Cryptography.ProtectedData]::Unprotect([System.IO.File]::ReadAllBytes($encryptedPath), $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    if ([Convert]::ToBase64String($sha.ComputeHash($bytes)) -ne [Convert]::ToBase64String($sha.ComputeHash($restored))) { throw 'Backup encryption roundtrip failed' }
    Remove-Item -LiteralPath $archive
    [Array]::Clear($bytes, 0, $bytes.Length)
    [Array]::Clear($restored, 0, $restored.Length)
    $sha.Dispose()
    $count++
}
Write-Output "Inventory backup encryption roundtrip verified: $count archives. Credential unchanged."
