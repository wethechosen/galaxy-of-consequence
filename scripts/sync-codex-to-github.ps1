param(
  [string]$ExpectedRepo = "wethechosen/galaxy-of-consequence",
  [string]$SyncBranch = "codex-master-sync",
  [string]$CommitMessage = "Sync authoritative Codex master"
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
  Write-Error $Message
  exit 1
}

function Run([string]$Command) {
  Write-Host "> $Command"
  Invoke-Expression $Command
  if ($LASTEXITCODE -ne 0) { Fail "Command failed: $Command" }
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
  Fail "origin points to '$origin', not '$ExpectedRepo'. Refusing to push."
}

$forbiddenTracked = git ls-files | Where-Object {
  $_ -match '(^|/)\.env($|\.)' -or
  $_ -match '\.sqlite($|-wal$|-shm$)' -or
  $_ -match '(^|/)\.vercel/'
} | Where-Object { $_ -ne '.env.example' }
if ($forbiddenTracked) {
  Fail ("Sensitive/runtime files are already tracked:`n" + ($forbiddenTracked -join "`n"))
}

Run "git fetch origin"

$currentBranch = (git branch --show-current).Trim()
if ($currentBranch -ne $SyncBranch) {
  $localBranchExists = git branch --list $SyncBranch
  if ($localBranchExists) {
    Run "git switch $SyncBranch"
  } else {
    $remoteBranchExists = git ls-remote --heads origin $SyncBranch
    if ($remoteBranchExists) {
      Run "git switch -c $SyncBranch --track origin/$SyncBranch"
    } else {
      Run "git switch -c $SyncBranch"
    }
  }
}

# Stage the complete working tree subject to .gitignore.
Run "git add -A"

$staged = git diff --cached --name-only
if (-not $staged) {
  Write-Host "No staged changes. Nothing to commit."
  exit 0
}

# Reject obvious secret-bearing files or populated secret assignments.
$forbiddenNames = $staged | Where-Object {
  $_ -match '(^|/)\.env($|\.)' -or
  $_ -match '(^|/)\.vercel/' -or
  $_ -match '\.sqlite($|-wal$|-shm$)'
} | Where-Object { $_ -ne '.env.example' }
if ($forbiddenNames) {
  Run "git reset"
  Fail ("Refusing to stage secret/runtime files:`n" + ($forbiddenNames -join "`n"))
}

$diff = git diff --cached --unified=0
$secretPatterns = @(
  '^\+[^+].*SUPABASE_SERVICE_ROLE_KEY\s*=\s*\S+',
  '^\+[^+].*GOC_SUPABASE_BRIDGE_KEY\s*=\s*\S+',
  '^\+[^+].*GOC_GPT_ACTION_KEY\s*=\s*\S+',
  '^\+[^+].*NVIDIA_API_KEY\s*=\s*\S+',
  '^\+[^+].*OPENAI_API_KEY\s*=\s*\S+',
  '^\+[^+].*sk-[A-Za-z0-9_-]{16,}',
  '^\+[^+].*service_role.*[A-Za-z0-9_-]{24,}'
)
foreach ($pattern in $secretPatterns) {
  if ($diff -match $pattern) {
    Run "git reset"
    Fail "A staged change appears to contain a secret. Review the diff before pushing."
  }
}

Write-Host "Running project validation before commit..."
if (Test-Path "package.json") {
  if (Test-Path "package-lock.json") {
    Run "npm ci"
  } else {
    Run "npm install"
  }

  $packageJson = Get-Content package.json -Raw | ConvertFrom-Json
  if ($packageJson.scripts.typecheck) { Run "npm run typecheck" }
  if ($packageJson.scripts.test) { Run "npm test" }
  if ($packageJson.scripts.build) { Run "npm run build" }
}

Write-Host "Staged files:"
$staged | ForEach-Object { Write-Host "  $_" }

Run "git commit -m `"$CommitMessage`""
Run "git push -u origin $SyncBranch"

$head = (git rev-parse HEAD).Trim()
Write-Host ""
Write-Host "PASS: authoritative Codex changes pushed safely."
Write-Host "Repository : $ExpectedRepo"
Write-Host "Branch     : $SyncBranch"
Write-Host "Commit     : $head"
Write-Host "Next: validate this exact commit in Vercel preview/production before merging to main."
