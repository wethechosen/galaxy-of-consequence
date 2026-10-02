param(
  [string]$ExpectedRepo = "wethechosen/galaxy-of-consequence",
  [string]$SyncBranch = "codex-master-sync"
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
  Write-Error $Message
  exit 1
}

$root = (git rev-parse --show-toplevel 2>$null)
if (-not $root) { Fail "This directory is not inside a Git repository." }
Set-Location $root

$origin = (git remote get-url origin 2>$null).Trim()
if (-not $origin) { Fail "No origin remote is configured." }

$normalized = $origin.ToLowerInvariant()
$expectedHttps = "https://github.com/$ExpectedRepo.git".ToLowerInvariant()
$expectedHttpsNoGit = "https://github.com/$ExpectedRepo".ToLowerInvariant()
$expectedSsh = "git@github.com:$ExpectedRepo.git".ToLowerInvariant()
if ($normalized -ne $expectedHttps -and $normalized -ne $expectedHttpsNoGit -and $normalized -ne $expectedSsh) {
  Fail "origin points to '$origin', not GitHub repository '$ExpectedRepo'. Do not push until this is corrected."
}

$forbiddenTracked = git ls-files | Where-Object {
  $_ -match '(^|/)\.env($|\.)' -or
  $_ -match '\.sqlite($|-wal$|-shm$)' -or
  $_ -match '(^|/)\.vercel/'
} | Where-Object { $_ -ne '.env.example' }
if ($forbiddenTracked) {
  Fail ("Sensitive/runtime files are tracked by Git:`n" + ($forbiddenTracked -join "`n"))
}

$branch = (git branch --show-current).Trim()
$status = git status --short
$head = (git rev-parse HEAD).Trim()

Write-Host "Galaxy of Consequence local master verification"
Write-Host "Repository root : $root"
Write-Host "Origin          : $origin"
Write-Host "Current branch  : $branch"
Write-Host "Current HEAD    : $head"
Write-Host "Sync branch     : $SyncBranch"
if ($status) {
  Write-Host "Working tree changes:"
  $status | ForEach-Object { Write-Host "  $_" }
} else {
  Write-Host "Working tree    : clean"
}

Write-Host ""
Write-Host "PASS: this local checkout points to the expected GitHub repository and no forbidden runtime/secret files are tracked."
Write-Host "Before production cutover, push the complete Codex working tree to '$SyncBranch', validate it, then promote that exact commit to main and Vercel."
