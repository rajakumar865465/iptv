# run_local.ps1
# Run the Flutter app on a connected Android phone over Wi-Fi.
# Auto-detects your PC's Wi-Fi IPv4 address (never localhost) and passes it
# to the app via --dart-define=BACKEND_URL.
#
# Usage:
#   ./run_local.ps1                  # uses auto-detected Wi-Fi IPv4 on port 5000
#   ./run_local.ps1 -Port 8080       # custom backend port
#   ./run_local.ps1 -IPv4 192.168.1.50   # override the IP manually

param(
    [int]$Port = 5000,
    [string]$IPv4 = ""
)

$ErrorActionPreference = "Stop"

# --- Resolve the Wi-Fi IPv4 address ---
$ip = $IPv4
if ([string]::IsNullOrWhiteSpace($ip)) {
    # Get IPv4 addresses on active wireless / ethernet adapters, skipping loopback & link-local.
    $candidates = @()
    try {
        $candidates = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
            Where-Object {
                $_.IPAddress -ne '127.0.0.1' -and
                -not $_.IPAddress.StartsWith('169.254.') -and
                $_.InterfaceAlias -notmatch 'Loopback|vEthernet|WSL'
            } |
            Select-Object -ExpandProperty IPAddress
    } catch {
        $candidates = @()
    }

    if ($candidates.Count -eq 0) {
        throw "Could not auto-detect a Wi-Fi/LAN IPv4 address. Run 'ipconfig', then pass it with -IPv4."
    }
    $ip = $candidates[0]
}

$backendUrl = "http://${ip}:${Port}"
Write-Host "Using backend URL: $backendUrl" -ForegroundColor Cyan

# --- Make sure a device is connected ---
$devices = flutter devices 2>$null
if ($LASTEXITCODE -ne 0) {
    throw "'flutter devices' failed. Is Flutter on your PATH?"
}

# --- Run debug on the connected device with the backend URL ---
flutter run --debug --dart-define=BACKEND_URL=$backendUrl
