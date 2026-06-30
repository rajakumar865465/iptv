ssh -i $HOME\.ssh\iptv_rsa -o StrictHostKeyChecking=no ubuntu@35.154.128.217 "cd /home/ubuntu/iptv && git pull && cd frontend && npm run build && pm2 restart iptv-frontend"
echo "Deployment Complete"
