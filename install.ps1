<#
.SYNOPSIS
  Installs VisualStruct on Windows from this checkout.

.DESCRIPTION
  cli      Core runtime + the "visualstruct" command
  code     cli + the Claude Code plugin (user scope)
  desktop  cli + the Claude Desktop packages (.mcpb and skill zip)
  both     everything above

  The runtime is installed from "npm pack" output into
  %USERPROFILE%\.local\visualstruct\v<version>, so nothing depends on this
  checkout or on "npm link" afterwards. Re-running is safe.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\install.ps1 -Mode both
#>
[CmdletBinding()]
param(
  [ValidateSet('', 'cli', 'code', 'desktop', 'both')]
  [string]$Mode = '',
  # Reinstall the runtime even if this version is already present.
  [switch]$Force,
  # Do not add %USERPROFILE%\.local\bin to the user PATH.
  [switch]$NoPath
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2
$env:npm_config_loglevel = 'error'

$Repo = $PSScriptRoot
$Marketplace = 'KelesogluMustafa/visualstruct'
$PluginId = 'visualstruct@visualstruct'

function Fail([string]$Message) {
  Write-Host ''
  Write-Host "ERROR: $Message" -ForegroundColor Red
  exit 1
}

if (-not $Mode) {
  Write-Host 'Usage: .\install.ps1 -Mode <cli|code|desktop|both> [-Force] [-NoPath]'
  Write-Host ''
  Write-Host '  cli      Core + CLI'
  Write-Host '  code     Core + CLI + Claude Code plugin'
  Write-Host '  desktop  Core + CLI + Claude Desktop packages'
  Write-Host '  both     All of the above'
  exit 1
}

$WantCode = $Mode -eq 'code' -or $Mode -eq 'both'
$WantDesktop = $Mode -eq 'desktop' -or $Mode -eq 'both'

$script:StepIndex = 0
$script:StepCount = 5
if ($WantCode) { $script:StepCount++ }
if ($WantDesktop) { $script:StepCount++ }

function Step([string]$Title) {
  $script:StepIndex++
  Write-Host ("[{0}/{1}] {2}... " -f $script:StepIndex, $script:StepCount, $Title) -NoNewline
}

function Done([string]$Status = 'OK') { Write-Host $Status }

# Runs a native command quietly; native stderr must not become a terminating PowerShell error.
function Invoke-Native([string]$What, [string]$Exe, [string[]]$Arguments, [switch]$PassThru) {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    if ($PassThru) { $output = & $Exe @Arguments } else { & $Exe @Arguments | Out-Null; $output = $null }
  } finally {
    $ErrorActionPreference = $previous
  }
  if ($LASTEXITCODE -ne 0) { Fail "$What failed (exit code $LASTEXITCODE)." }
  return $output
}

function Read-Json([string]$What, [string]$Exe, [string[]]$Arguments) {
  $text = (Invoke-Native $What $Exe $Arguments -PassThru) -join "`n"
  # Windows PowerShell 5.1 emits a JSON array as one object, so it is unrolled by hand.
  $parsed = $text | ConvertFrom-Json
  $items = @()
  foreach ($item in $parsed) { if ($item) { $items += $item } }
  return $items
}

function Find-Named([object[]]$Items, [string]$Property, [string]$Value) {
  foreach ($item in $Items) { if ($item.$Property -eq $Value) { return $item } }
  return $null
}

function Find-D2 {
  if ($env:VISUALSTRUCT_D2 -and (Test-Path $env:VISUALSTRUCT_D2)) { return $env:VISUALSTRUCT_D2 }
  $onPath = Get-Command d2 -ErrorAction SilentlyContinue
  if ($onPath) { return $onPath.Source }
  $programFiles = if ($env:ProgramFiles) { $env:ProgramFiles } else { 'C:\Program Files' }
  $default = Join-Path $programFiles 'D2\d2.exe'
  if (Test-Path $default) { return $default }
  return $null
}

# --- 1. Prerequisites -------------------------------------------------------

Step 'Checking prerequisites'
if ($env:OS -ne 'Windows_NT') { Fail 'This installer is for Windows. On other systems see the manual steps in README.md.' }
if (-not (Test-Path (Join-Path $Repo 'package.json'))) { Fail "package.json not found next to install.ps1 ($Repo)." }

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Fail "Node.js 22+ is required.`n  Install: https://nodejs.org/  or  winget install OpenJS.NodeJS.LTS" }
$nodeVersion = (& node -p 'process.versions.node').Trim()
if ([int]($nodeVersion.Split('.')[0]) -lt 22) { Fail "Node.js 22+ is required, found $nodeVersion.`n  Install: https://nodejs.org/  or  winget install OpenJS.NodeJS.LTS" }
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { Fail 'npm was not found. It normally ships with Node.js.' }
if ($WantCode) {
  if (-not (Get-Command claude -ErrorAction SilentlyContinue)) { Fail "The Claude Code CLI (claude) was not found.`n  Install Claude Code first, or use -Mode cli / -Mode desktop." }
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Fail 'git is required to add the Claude Code plugin marketplace.' }
}
Done "OK (Node $nodeVersion)"

$Version = (Get-Content (Join-Path $Repo 'package.json') -Raw | ConvertFrom-Json).version
$Runtime = Join-Path $env:USERPROFILE ".local\visualstruct\v$Version"
$RuntimePackage = Join-Path $Runtime 'node_modules\visualstruct\package.json'
$RuntimeCli = Join-Path $Runtime 'node_modules\visualstruct\dist\cli.js'

# --- 2. Runtime -------------------------------------------------------------

Step "Installing VisualStruct runtime v$Version"
$installed = $false
if ((Test-Path $RuntimePackage) -and (Test-Path (Join-Path $Runtime 'desktop-launch.mjs'))) {
  $installed = (Get-Content $RuntimePackage -Raw | ConvertFrom-Json).version -eq $Version
}
Push-Location $Repo
try {
  if ($installed -and -not $Force) {
    Done 'Already installed'
  } else {
    if ($Force -or -not (Test-Path (Join-Path $Repo 'node_modules'))) {
      Invoke-Native 'npm ci' 'npm.cmd' @('ci', '--no-audit', '--no-fund')
    }
    Invoke-Native 'Runtime install' 'node' @('scripts\desktop-runtime.mjs')
    Done
  }
} finally {
  Pop-Location
}

# --- 3. CLI command ---------------------------------------------------------

Step 'Setting up the visualstruct command'
$Bin = Join-Path $env:USERPROFILE '.local\bin'
$Shim = Join-Path $Bin 'visualstruct.cmd'
$shimContent = @(
  '@echo off',
  "rem Generated by VisualStruct install.ps1. Starts the v$Version runtime; no checkout or npm link involved.",
  "node `"%USERPROFILE%\.local\visualstruct\v$Version\node_modules\visualstruct\dist\cli.js`" %*"
)
New-Item -ItemType Directory -Force -Path $Bin | Out-Null
$shimCurrent = $false
if (Test-Path $Shim) { $shimCurrent = ((Get-Content $Shim) -join "`n") -eq ($shimContent -join "`n") }
if (-not $shimCurrent) { Set-Content -Path $Shim -Value $shimContent -Encoding ASCII }

$pathChanged = $false
if (-not $NoPath) {
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  $entries = @()
  if ($userPath) { $entries = @($userPath.Split(';') | Where-Object { $_ } | ForEach-Object { $_.TrimEnd('\') }) }
  if ($entries -notcontains $Bin.TrimEnd('\')) {
    $newPath = if ($userPath) { $userPath.TrimEnd(';') + ';' + $Bin } else { $Bin }
    [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
    $pathChanged = $true
  }
}
if (@($env:Path.Split(';') | ForEach-Object { $_.TrimEnd('\') }) -notcontains $Bin.TrimEnd('\')) { $env:Path = "$env:Path;$Bin" }
if ($pathChanged) { Done 'OK (added to user PATH)' } elseif ($shimCurrent) { Done 'Already up to date' } else { Done }

# --- 4. D2 ------------------------------------------------------------------

Step 'Checking D2'
$d2 = Find-D2
if ($d2) { Done } else { Done 'MISSING' }

# --- 5. Claude Code plugin --------------------------------------------------

$codeStatus = ''
if ($WantCode) {
  Step 'Installing Claude Code plugin'
  $known = Find-Named @(Read-Json 'Listing marketplaces' 'claude' @('plugin', 'marketplace', 'list', '--json')) 'name' 'visualstruct'
  $fromGitHub = $true
  if (-not $known) {
    Invoke-Native 'Adding the plugin marketplace' 'claude' @('plugin', 'marketplace', 'add', $Marketplace)
  } elseif ($known.source -eq 'github') {
    Invoke-Native 'Updating the plugin marketplace' 'claude' @('plugin', 'marketplace', 'update', 'visualstruct')
  } else {
    # A local marketplace is a development setup; leave it exactly as it is.
    $fromGitHub = $false
  }

  $plugin = Find-Named @(Read-Json 'Listing plugins' 'claude' @('plugin', 'list', '--json')) 'id' $PluginId
  if (-not $plugin) {
    Invoke-Native 'Installing the plugin' 'claude' @('plugin', 'install', $PluginId, '--scope', 'user')
    $codeStatus = 'Plugin installed and enabled.'
  } else {
    if (-not $plugin.enabled) { Invoke-Native 'Enabling the plugin' 'claude' @('plugin', 'enable', $PluginId) }
    if ($fromGitHub) {
      Invoke-Native 'Updating the plugin' 'claude' @('plugin', 'update', $PluginId)
      $codeStatus = 'Plugin already installed; updated and enabled.'
    } else {
      $codeStatus = 'Plugin already installed from a local marketplace; left as is.'
    }
  }
  Done
}

# --- 6. Claude Desktop packages ---------------------------------------------

$Mcpb = Join-Path $Repo "build\visualstruct-$Version.mcpb"
$SkillZip = Join-Path $Repo 'build\visualstruct-skill.zip'
if ($WantDesktop) {
  Step 'Building Claude Desktop packages'
  Push-Location $Repo
  try {
    if (-not (Test-Path (Join-Path $Repo 'node_modules'))) { Invoke-Native 'npm ci' 'npm.cmd' @('ci', '--no-audit', '--no-fund') }
    Invoke-Native 'Packaging' 'node' @('scripts\desktop-pack.mjs')
  } finally {
    Pop-Location
  }
  if (-not ((Test-Path $Mcpb) -and (Test-Path $SkillZip))) { Fail 'Desktop packages were not created.' }
  Done
}

# --- 7. Doctor --------------------------------------------------------------

Step 'Running doctor'
$probe = Join-Path $env:TEMP 'visualstruct-doctor'
Invoke-Native 'visualstruct doctor' 'node' @($RuntimeCli, 'doctor', '--out', $probe)
Remove-Item -Recurse -Force $probe -ErrorAction SilentlyContinue
Done 'PASS'

# --- Summary ----------------------------------------------------------------

Write-Host ''
Write-Host "VisualStruct $Version installation complete."
Write-Host ''
Write-Host 'Runtime:'
Write-Host "  $Runtime"
Write-Host ''
Write-Host 'CLI:'
Write-Host '  visualstruct doctor'
if ($pathChanged) { Write-Host '  Open a new terminal first: the user PATH was just updated.' }
if ($NoPath) { Write-Host "  PATH was not changed; the command is at $Shim" }

if (-not $d2) {
  Write-Host ''
  Write-Host 'D2 is not installed. Infographic, comparison and timeline types work without it;'
  Write-Host 'architecture, flow and sequence diagrams need it:'
  Write-Host '  winget install Terrastruct.D2'
}

if ($WantCode) {
  Write-Host ''
  Write-Host 'Claude Code:'
  Write-Host "  $codeStatus"
  Write-Host '  Restart Claude Code so new sessions pick it up.'
}

if ($WantDesktop) {
  Write-Host ''
  Write-Host 'Claude Desktop (two manual steps):'
  Write-Host "  1. Settings > Extensions > install  $Mcpb"
  Write-Host "  2. Settings > Capabilities > Skills > upload  $SkillZip"
}

if ($Mode -eq 'both') {
  Write-Host ''
  Write-Host 'Note: a skill uploaded to your account can also sync into Claude Code, where the plugin'
  Write-Host 'already provides it. If it shows up twice there, keep only one of the two.'
}
