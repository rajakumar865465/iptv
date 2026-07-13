# EC2 Deployment Guide

## Why `/logs` returns 404

The frontend is a Next.js app. All routes like `/logs`, `/users`, `/dashboard` are **client-side routes** — nginx must proxy ALL requests to Next.js, which then handles the routing internally.

If nginx is set up to only serve static files, these routes return 404.

---

## Fix: Nginx Configuration

Copy the provided `nginx.conf` to the server:

```bash
sudo cp nginx.conf /etc/nginx/sites-available/iptv
sudo ln -sf /etc/nginx/sites-available/iptv /etc/nginx/sites-enabled/iptv
sudo rm -f /etc/nginx/sites-enabled/default   # Remove default config
sudo nginx -t                                  # Test config
sudo systemctl reload nginx                    # Apply
```

The key section is:
```nginx
location / {
    proxy_pass http://127.0.0.1:3000;   # Next.js
    ...
}
```

This ensures ALL routes (`/logs`, `/users`, etc.) are passed to Next.js.

---

## Process Management (PM2)

Start backend and frontend with PM2:

```bash
npm install -g pm2

# Start backend
cd /home/ubuntu/iptv/backend
pm2 start src/app.js --name "iptv-backend"

# Build and start frontend
cd /home/ubuntu/iptv/frontend
npm run build
pm2 start npm --name "iptv-frontend" -- start

# Save and auto-start on reboot
pm2 save
pm2 startup
```

---

## Environment Variables

### Backend `/home/ubuntu/iptv/backend/.env`
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=iptv_db
DB_USER=postgres
DB_PASSWORD=your_password

JWT_SECRET=your_strong_jwt_secret_here
ADMIN_JWT_SECRET=your_strong_admin_secret_here

PORT=5000
NODE_ENV=production

CORS_ORIGINS=http://35.154.128.217

RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# FCM (optional - for push notifications)
FCM_PROJECT_ID=your_project_id
FCM_CLIENT_EMAIL=your_client_email
FCM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

### Frontend `/home/ubuntu/iptv/frontend/.env.local`
```
NEXT_PUBLIC_API_URL=http://nivatv.abrdns.com
BACKEND_URL=http://127.0.0.1:5000
```

---

## Quick Redeploy

```bash
cd /home/ubuntu/iptv

# Pull latest code
git pull

# Backend
cd backend
npm install
pm2 restart iptv-backend

# Frontend  
cd ../frontend
npm install
npm run build
pm2 restart iptv-frontend
```
