# EC2 Production Deploy Script for NivaTV
param(
    [string]$HostIp = "44.206.18.189",
    [string]$KeyPath = ""
)

if (-not $KeyPath) {
    if (Test-Path "F:\chrome\iptv.pem") {
        $KeyPath = "F:\chrome\iptv.pem"
    } elseif (Test-Path "$HOME\.ssh\iptv_rsa") {
        $KeyPath = "$HOME\.ssh\iptv_rsa"
    } else {
        throw "No SSH private key found. Specify -KeyPath <path>"
    }
}

Write-Host "Deploying to $HostIp using key $KeyPath..." -ForegroundColor Cyan

$remoteCmd = @'
cd /home/ubuntu/iptv &&
git pull &&
cd backend &&
npm install &&
psql "$DATABASE_URL" -f scripts/update_release_notification.sql 2>/dev/null || true &&
node fix_payment.js &&
pm2 restart iptv-backend &&
sleep 3 &&
cd ../frontend &&
npm install &&
npm run build &&
pm2 restart iptv-frontend &&
sleep 3 &&
pm2 status
'@

ssh -i "$KeyPath" -o StrictHostKeyChecking=no "ubuntu@$HostIp" "$remoteCmd"

Write-Host "Deployment Complete!" -ForegroundColor Green
