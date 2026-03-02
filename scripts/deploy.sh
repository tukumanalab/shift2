#!/bin/bash
set -e
cd /srv/shift2
echo "[$(date)] Deploy started"
git pull origin main
npm ci --omit=dev
npm run build
pm2 restart shift2
echo "[$(date)] Deploy finished"
