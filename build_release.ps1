# build_release.ps1
# Build a production (release) APK. The backend URL is MANDATORY.
#
# Usage:
#   ./build_release.ps1 -BackendUrl http://35.154.128.217
#   ./build_release.ps1 -BackendUrl http://35.154.128.217 -SplitPerAbi

param(
    [Parameter(Mandatory = $true, HelpMessage = "Production backend HTTPS URL, e.g. https://api.yourdomain.com")]
    [string]$BackendUrl,
    [switch]$SplitPerAbi
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

Write-Host "Building release APK with BACKEND_URL=$url" -ForegroundColor Cyan

$flutterArgs = @("build", "apk", "--release", "--dart-define=BACKEND_URL=$url")
if ($SplitPerAbi) {
    $flutterArgs += "--split-per-abi"
}

& flutter @flutterArgs

if ($LASTEXITCODE -ne 0) {
    throw "Flutter release build failed with exit code $LASTEXITCODE."
}

Write-Host "`nRelease APK built." -ForegroundColor Green
Write-Host "APK location: build/app/outputs/flutter-apk/app-release.apk" -ForegroundColor Green
