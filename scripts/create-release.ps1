# Naruto RPG - Release Script
# This script creates a ZIP file for GitHub releases

param(
    [string]$Version = "1.0.0"
)

$ErrorActionPreference = "Stop"

# Paths
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ReleaseName = "naruto-rpg"
$OutputDir = Join-Path $ProjectRoot "releases"
$ZipPath = Join-Path $OutputDir "$ReleaseName.zip"
$TempDir = Join-Path $env:TEMP "$ReleaseName-release-temp"

Write-Host "=== Naruto RPG Release Script ===" -ForegroundColor Cyan
Write-Host "Version: $Version" -ForegroundColor Yellow

# Create output directory if it doesn't exist
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
    Write-Host "Created releases directory" -ForegroundColor Green
}

# Clean up temp directory if it exists
if (Test-Path $TempDir) {
    Remove-Item -Recurse -Force $TempDir
}

# Create temp directory structure
$TempSystemDir = Join-Path $TempDir $ReleaseName
New-Item -ItemType Directory -Path $TempSystemDir | Out-Null

Write-Host "Copying files..." -ForegroundColor Yellow

# Files and folders to include
$IncludeItems = @(
    "module",
    "templates",
    "styles",
    "lang",
    "assets",
    "system.json",
    "template.json",
    "README.md",
    "LICENSE"
)

# Copy items
foreach ($item in $IncludeItems) {
    $sourcePath = Join-Path $ProjectRoot $item
    $destPath = Join-Path $TempSystemDir $item
    
    if (Test-Path $sourcePath) {
        if ((Get-Item $sourcePath).PSIsContainer) {
            Copy-Item -Path $sourcePath -Destination $destPath -Recurse
            Write-Host "  + $item/" -ForegroundColor Gray
        } else {
            Copy-Item -Path $sourcePath -Destination $destPath
            Write-Host "  + $item" -ForegroundColor Gray
        }
    } else {
        Write-Host "  ! $item not found, skipping" -ForegroundColor DarkYellow
    }
}

# Remove old ZIP if exists
if (Test-Path $ZipPath) {
    Remove-Item $ZipPath
}

# Create ZIP
Write-Host "Creating ZIP archive..." -ForegroundColor Yellow
Compress-Archive -Path $TempSystemDir -DestinationPath $ZipPath -CompressionLevel Optimal

# Copy system.json to releases folder (needed separately for GitHub release)
Copy-Item -Path (Join-Path $ProjectRoot "system.json") -Destination $OutputDir

# Clean up temp directory
Remove-Item -Recurse -Force $TempDir

# Output results
$ZipSize = [math]::Round((Get-Item $ZipPath).Length / 1KB, 2)
Write-Host ""
Write-Host "=== Release Created Successfully ===" -ForegroundColor Green
Write-Host "ZIP: $ZipPath ($ZipSize KB)" -ForegroundColor Cyan
Write-Host "system.json: $(Join-Path $OutputDir 'system.json')" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Go to: https://github.com/3darkman/naruto-rpg/releases/new" -ForegroundColor White
Write-Host "2. Tag: v$Version" -ForegroundColor White
Write-Host "3. Upload both files from the 'releases' folder" -ForegroundColor White
