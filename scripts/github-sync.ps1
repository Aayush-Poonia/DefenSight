# Push this project to GitHub (run in PowerShell from anywhere).
# Requires: Git installed — https://git-scm.com/download/win
#
# Usage (from project root):
#   powershell -ExecutionPolicy Bypass -File .\scripts\github-sync.ps1
#
# First-time GitHub repo (empty or with README): script uses main + origin.

param(
  [string]$RemoteUrl = "https://github.com/Aayush-123638/remix-of-truth-seeker-2.0.git",
  [string]$CommitMessage = "Update project"
)

$ErrorActionPreference = "Stop"
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Error "Git not found in PATH. Install Git for Windows, then reopen the terminal."
}

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root
Write-Host "Repository root: $root"

if (-not (Test-Path (Join-Path $root ".git"))) {
  Write-Host "Initializing git repo..."
  git init
}

$hasOrigin = git remote get-url origin 2>$null
if ($LASTEXITCODE -eq 0) {
  Write-Host "Setting origin URL..."
  git remote set-url origin $RemoteUrl
} else {
  Write-Host "Adding origin..."
  git remote add origin $RemoteUrl
}

git add -A
$st = git status --porcelain
if (-not $st) {
  Write-Host "Nothing to commit (working tree clean)."
} else {
  git commit -m $CommitMessage
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Commit failed (configure user.name / user.email if needed: git config user.email you@example.com)"
    exit $LASTEXITCODE
  }
}

git branch -M main 2>$null

Write-Host "Pushing to origin main..."
git push -u origin main
if ($LASTEXITCODE -ne 0) {
  Write-Host @"

Push failed. Common fixes:
  1) GitHub auth: use HTTPS with a Personal Access Token, or: git remote set-url origin git@github.com:Aayush-123638/remix-of-truth-seeker-2.0.git
  2) Remote already has commits: run once:
       git fetch origin
       git pull origin main --allow-unrelated-histories
       (resolve conflicts if any, then commit)
       git push -u origin main
"@
  exit $LASTEXITCODE
}

Write-Host "Done. Remote: $RemoteUrl"
