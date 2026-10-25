# Stores the existing production database password locally, never in Git.
# Windows DPAPI binds the encrypted password to this Windows user/machine.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'This preparation script requires Windows DPAPI.' }
$backupRoot = Join-Path $env:LOCALAPPDATA 'MirpanelPrivateBackups'
$credentialPath = Join-Path $backupRoot 'mirpanel-payments.credential.clixml'
if (Test-Path -LiteralPath $credentialPath) {
    throw 'A protected credential already exists. It was not overwritten.'
}
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
# Read and persist ONLY the DACL (Access section). Set-Acl can attempt to
# persist other sections, including SACL, requiring SeSecurityPrivilege.
$directory = Get-Item -LiteralPath $backupRoot
$acl = $directory.GetAccessControl([System.Security.AccessControl.AccessControlSections]::Access)
$acl.SetAccessRuleProtection($true, $false)
foreach ($existingRule in @($acl.Access)) {
    [void]$acl.RemoveAccessRuleSpecific($existingRule)
}
$inheritance = [System.Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    $identity.User, 'FullControl', $inheritance,
    [System.Security.AccessControl.PropagationFlags]::None,
    [System.Security.AccessControl.AccessControlType]::Allow
)
$acl.AddAccessRule($rule)
$directory.SetAccessControl($acl)
$verifiedAcl = $directory.GetAccessControl([System.Security.AccessControl.AccessControlSections]::Access)
if (-not $verifiedAcl.AreAccessRulesProtected) { throw 'Directory access inheritance is not disabled; nothing saved.' }
$verifiedRules = @($verifiedAcl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]))
if ($verifiedRules.Count -ne 1 -or $verifiedRules[0].IdentityReference -ne $identity.User -or
    $verifiedRules[0].AccessControlType -ne [System.Security.AccessControl.AccessControlType]::Allow -or
    $verifiedRules[0].FileSystemRights -ne [System.Security.AccessControl.FileSystemRights]::FullControl) {
    throw 'Owner-only directory access could not be verified; nothing saved.'
}
Write-Host 'Project: mirpanel-payments (sidgtcgyqkdplgfabmmp)'
Write-Host 'Enter the EXISTING database password locally. Do not reset it or paste it into chat.'
$securePassword = Read-Host 'Existing PostgreSQL password' -AsSecureString
if ($securePassword.Length -eq 0) { throw 'No password supplied; nothing saved.' }
$credential = New-Object System.Management.Automation.PSCredential(
    'postgres.sidgtcgyqkdplgfabmmp', $securePassword
)
$credential | Export-Clixml -LiteralPath $credentialPath
$securePassword.Dispose()
Write-Host 'Protected local credential saved. No database connection, migration, or deployment was performed.'
