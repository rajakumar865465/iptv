ssh -i $HOME\.ssh\iptv_rsa -o StrictHostKeyChecking=no ubuntu@35.174.78.33 "cd /home/ubuntu/iptv && git pull && cd backend && npm install && npm run recover && npm run import-premium && node fix_payment.js && pm2 restart iptv-backend && sleep 5 && cd ../frontend && npm install && npm run build && pm2 restart iptv-frontend"
echo "Deployment Complete"
