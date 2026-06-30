ssh -i $HOME\.ssh\iptv_rsa -o StrictHostKeyChecking=no ubuntu@35.154.128.217 "cd /home/ubuntu/iptv && git pull && cd backend && npm install && npm run recover && cd ../frontend && npm install && npm run build && pm2 restart iptv-frontend && pm2 restart iptv-backend"
echo "Deployment Complete"
