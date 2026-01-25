$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step($msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

Write-Step "Moving to script directory"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

Write-Step "Preventing Git from discovering parent repo"
# If this folder lives inside another git repo, git will walk upward.
# This env var tells git to stop searching above this directory.
$env:GIT_CEILING_DIRECTORIES = $repoRoot
Remove-Item Env:\GIT_DIR, Env:\GIT_WORK_TREE -ErrorAction SilentlyContinue

Write-Step "Ensuring secrets are not tracked"
if (Test-Path ".env.local") {
  Write-Host "Found .env.local (good: should be ignored by .gitignore)."
}

Write-Step "Initializing a standalone repo in transition-for-strava"
if (Test-Path ".git") {
  Write-Host "Removing existing .git to start clean..."
  Remove-Item -Recurse -Force ".git"
}

git init -b main | Out-Host

Write-Step "Verifying repo root"
git rev-parse --show-toplevel | Out-Host

Write-Step "Staging files"
git add . | Out-Host

Write-Step "Making initial commit (skip if nothing to commit)"
try {
  git commit -m "Initial commit: Transition for Strava V1" | Out-Host
} catch {
  Write-Host "No commit created (possibly nothing changed). Continuing..."
}

Write-Step "Configuring GitHub remote (HTTPS)"
$remote = "https://github.com/thaum-labs/transition-for-strava.git"
try {
  git remote remove origin | Out-Null
} catch {}
git remote add origin $remote | Out-Host
git remote -v | Out-Host

Write-Step "Confirming no env files are tracked"
git ls-files | Select-String "\.env" | ForEach-Object { $_.Line } | Out-Host

Write-Step "Pushing to GitHub (will prompt for auth once via Git Credential Manager)"
git push -u origin main | Out-Host

Write-Step "Done"
Write-Host "If push succeeded, check: https://github.com/thaum-labs/transition-for-strava" -ForegroundColor Green

# Cleanup env var for this session
Remove-Item Env:\GIT_CEILING_DIRECTORIES -ErrorAction SilentlyContinue

