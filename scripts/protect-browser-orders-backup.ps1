$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$root = Join-Path $env:LOCALAPPDATA 'MirpanelPrivateBackups'
$count = 0
foreach ($run in (Get-ChildItem -LiteralPath $root -Directory | Where-Object { $_.Name -like 'browser-orders-*' -or $_.Name -like 'admin-sessions-*' })) {
    $dump = Join-Path $run.FullName 'public.dump'
    if (-not (Test-Path -LiteralPath $dump)) { continue }
    $bytes = [System.IO.File]::ReadAllBytes($dump)
    $encrypted = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    $target = $dump + '.dpapi'
    [System.IO.File]::WriteAllBytes($target, $encrypted)
    $restored = [System.Security.Cryptography.ProtectedData]::Unprotect([System.IO.File]::ReadAllBytes($target), $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    if ([Convert]::ToBase64String($sha.ComputeHash($bytes)) -ne [Convert]::ToBase64String($sha.ComputeHash($restored))) { throw 'Encryption roundtrip mismatch' }
    Remove-Item -LiteralPath $dump
    [Array]::Clear($bytes, 0, $bytes.Length)
    [Array]::Clear($restored, 0, $restored.Length)
    $sha.Dispose()
    $count++
}
Write-Output "Encrypted archives verified: $count; plaintext archive copies removed; credential unchanged."
