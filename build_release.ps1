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
    [switch]$BuildUniversal = $true,
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

Write-Host "Building optimized release APKs with BACKEND_URL=$url" -ForegroundColor Cyan

Push-Location mobile
try {
    $pubspecContent = Get-Content -Path "pubspec.yaml" -Raw
    $appVersion = "2.8.7"
    if ($pubspecContent -match '(?m)^version:\s*([0-9]+\.[0-9]+\.[0-9]+)') {
        $appVersion = $Matches[1]
    }

    if ($SplitPerAbi) {
        $splitArgs = @(
            "build", "apk", "--release",
            "--dart-define=BACKEND_URL=$url",
            "--obfuscate",
            "--split-debug-info=build/app/outputs/symbols",
            "--split-per-abi"
        )
        Write-Host "Running: flutter $($splitArgs -join ' ')" -ForegroundColor Yellow
        & flutter @splitArgs
        if ($LASTEXITCODE -ne 0) {
            throw "Flutter split-per-abi release build failed with exit code $LASTEXITCODE."
        }
    }

    if ($BuildUniversal -or -not $SplitPerAbi) {
        $universalArgs = @(
            "build", "apk", "--release",
            "--dart-define=BACKEND_URL=$url",
            "--obfuscate",
            "--split-debug-info=build/app/outputs/symbols"
        )
        Write-Host "Running: flutter $($universalArgs -join ' ')" -ForegroundColor Yellow
        & flutter @universalArgs
        if ($LASTEXITCODE -ne 0) {
            throw "Flutter universal release build failed with exit code $LASTEXITCODE."
        }
    }

    Write-Host "`nRelease APKs built successfully." -ForegroundColor Green

    if ($CopyToBackend) {
        $targets = @(
            (Join-Path ".." "backend/public/downloads"),
            (Join-Path ".." "frontend/public/downloads")
        )

        $arm64Apk = "build/app/outputs/flutter-apk/app-arm64-v8a-release.apk"
        $arm32Apk = "build/app/outputs/flutter-apk/app-armeabi-v7a-release.apk"
        $x86Apk = "build/app/outputs/flutter-apk/app-x86_64-release.apk"
        $universalApk = "build/app/outputs/flutter-apk/app-release.apk"

        foreach ($dir in $targets) {
            if (-not (Test-Path $dir)) {
                New-Item -ItemType Directory -Path $dir -Force | Out-Null
            }

            if (Test-Path $arm64Apk) {
                Copy-Item -Path $arm64Apk -Destination (Join-Path $dir "app-release.apk") -Force
                Copy-Item -Path $arm64Apk -Destination (Join-Path $dir "NivaTV_arm64_v$appVersion.apk") -Force
                Write-Host "Copied $arm64Apk -> $dir/app-release.apk" -ForegroundColor Green
            } elseif (Test-Path $universalApk) {
                Copy-Item -Path $universalApk -Destination (Join-Path $dir "app-release.apk") -Force
                Write-Host "Copied $universalApk -> $dir/app-release.apk" -ForegroundColor Green
            }

            if (Test-Path $arm32Apk) {
                Copy-Item -Path $arm32Apk -Destination (Join-Path $dir "app-release-32bit.apk") -Force
                Copy-Item -Path $arm32Apk -Destination (Join-Path $dir "NivaTV_arm32_v$appVersion.apk") -Force
                Write-Host "Copied $arm32Apk -> $dir/app-release-32bit.apk" -ForegroundColor Green
            }

            if (Test-Path $x86Apk) {
                Copy-Item -Path $x86Apk -Destination (Join-Path $dir "app-x86_64-release.apk") -Force
                Copy-Item -Path $x86Apk -Destination (Join-Path $dir "NivaTV_x86_64_v$appVersion.apk") -Force
                Write-Host "Copied $x86Apk -> $dir/app-x86_64-release.apk" -ForegroundColor Green
            }

            if (Test-Path $universalApk) {
                Copy-Item -Path $universalApk -Destination (Join-Path $dir "app-universal-release.apk") -Force
                Write-Host "Copied $universalApk -> $dir/app-universal-release.apk" -ForegroundColor Green
            }
        }
    }
} finally {
    Pop-Location
}
