# build_release.ps1
# Build a production (release) APK. The backend URL defaults to production.
#
# Usage:
#   ./build_release.ps1
#   ./build_release.ps1 -SplitPerAbi
#   ./build_release.ps1 -BackendUrl https://nivatv.luxomall.in -SplitPerAbi

param(
    [string]$BackendUrl = "https://nivatv.luxomall.in",
    [switch]$SplitPerAbi = $true,
    [switch]$CopyToBackend = $true
)

$ErrorActionPreference = "Stop"

# Normalize: trim trailing slash.
$url = $BackendUrl.TrimEnd('/')

if (-not ($url -match '^https?://')) {
    throw "BackendUrl must start with http:// or https://. Got: $url"
}
if ($url -match '^http://') {
    Write-Warning "Building a release APK against an http:// URL ($url). Production should use https://."
}

Write-Host "Building optimized release APK with BACKEND_URL=$url" -ForegroundColor Cyan

Push-Location mobile
try {
    # Remove stale diff/temp files if present
    if (Test-Path "diff.txt") {
        Remove-Item "diff.txt" -Force
    }

    $flutterArgs = @(
        "build", "apk", "--release",
        "--dart-define=BACKEND_URL=$url",
        "--obfuscate",
        "--split-debug-info=build/app/outputs/symbols"
    )

    if ($SplitPerAbi) {
        $flutterArgs += "--split-per-abi"
    }

    Write-Host "Running: flutter $($flutterArgs -join ' ')" -ForegroundColor Yellow
    & flutter @flutterArgs

    if ($LASTEXITCODE -ne 0) {
        throw "Flutter release build failed with exit code $LASTEXITCODE."
    }

    Write-Host "`nRelease APK built successfully." -ForegroundColor Green

    if ($CopyToBackend) {
        $backendDownloads = Join-Path ".." "backend/public/downloads"
        if (-not (Test-Path $backendDownloads)) {
            New-Item -ItemType Directory -Path $backendDownloads -Force | Out-Null
        }

        $arm64Apk = "build/app/outputs/flutter-apk/app-arm64-v8a-release.apk"
        $arm32Apk = "build/app/outputs/flutter-apk/app-armeabi-v7a-release.apk"
        $universalApk = "build/app/outputs/flutter-apk/app-release.apk"

        if (Test-Path $arm64Apk) {
            Copy-Item -Path $arm64Apk -Destination (Join-Path $backendDownloads "app-release.apk") -Force
            Write-Host "Copied $arm64Apk -> backend/public/downloads/app-release.apk" -ForegroundColor Green
        } elseif (Test-Path $universalApk) {
            Copy-Item -Path $universalApk -Destination (Join-Path $backendDownloads "app-release.apk") -Force
            Write-Host "Copied $universalApk -> backend/public/downloads/app-release.apk" -ForegroundColor Green
        }

        if (Test-Path $arm32Apk) {
            Copy-Item -Path $arm32Apk -Destination (Join-Path $backendDownloads "app-release-32bit.apk") -Force
            Write-Host "Copied $arm32Apk -> backend/public/downloads/app-release-32bit.apk" -ForegroundColor Green
        }
    }
} finally {
    Pop-Location
}
