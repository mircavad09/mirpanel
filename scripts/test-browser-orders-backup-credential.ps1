# Synthetic credential only; no production credentials or database access.
$ErrorActionPreference = 'Stop'
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('mirpanel-credential-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
$previousLocalAppData = $env:LOCALAPPDATA
$syntheticPassword = [guid]::NewGuid().ToString('N')
$scriptPath = Join-Path $PSScriptRoot 'set-browser-orders-backup-credential.ps1'
$checks = 0
function Assert-Test($condition, $message) {
    if (-not $condition) { throw $message }
    $script:checks++
}
function Read-Host { param($Prompt, [switch]$AsSecureString)
    if (-not $AsSecureString) { throw 'Password prompt must use SecureString' }
    ConvertTo-SecureString $syntheticPassword -AsPlainText -Force
}
try {
    $env:LOCALAPPDATA = $testRoot
    & $scriptPath 6>$null
    $directoryPath = Join-Path $testRoot 'MirpanelPrivateBackups'
    $filePath = Join-Path $directoryPath 'mirpanel-payments.credential.clixml'
    Assert-Test (Test-Path -LiteralPath $filePath) 'Credential file missing'
    $restored = Import-Clixml -LiteralPath $filePath
    Assert-Test ($restored.GetNetworkCredential().Password -ceq $syntheticPassword) 'DPAPI roundtrip failed'
    Assert-Test ($restored.UserName -eq 'postgres.sidgtcgyqkdplgfabmmp') 'Wrong database user'
    Assert-Test (-not ([System.IO.File]::ReadAllText($filePath).Contains($syntheticPassword))) 'Plaintext secret found'
    foreach ($pathToCheck in @($directoryPath, $filePath)) {
        $item = Get-Item -LiteralPath $pathToCheck
        $acl = $item.GetAccessControl([System.Security.AccessControl.AccessControlSections]::Access)
        $rules = @($acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]))
        Assert-Test ($rules.Count -eq 1 -and $rules[0].IdentityReference -eq [System.Security.Principal.WindowsIdentity]::GetCurrent().User) 'Unexpected access principal'
    }
    $before = (Get-FileHash -LiteralPath $filePath).Hash
    $blocked = $false
    try { & $scriptPath 6>$null } catch { $blocked = $_.Exception.Message -like '*already exists*' }
    Assert-Test ($blocked -and (Get-FileHash -LiteralPath $filePath).Hash -eq $before) 'Existing credential overwritten'
    Write-Output "PASS: $checks synthetic credential checks; no database operations."
} finally {
    $env:LOCALAPPDATA = $previousLocalAppData
    Remove-Item Function:Read-Host -ErrorAction SilentlyContinue
    $fileToRemove = Join-Path $testRoot 'MirpanelPrivateBackups/mirpanel-payments.credential.clixml'
    if (Test-Path -LiteralPath $fileToRemove) { Remove-Item -LiteralPath $fileToRemove }
    $directoryToRemove = Join-Path $testRoot 'MirpanelPrivateBackups'
    if (Test-Path -LiteralPath $directoryToRemove) { Remove-Item -LiteralPath $directoryToRemove }
    Remove-Item -LiteralPath $testRoot
}
