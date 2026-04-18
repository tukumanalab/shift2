#!/bin/bash
set -e
cd /srv/shift2
echo "[$(date)] Deploy started"
git pull origin main
npm ci
npm run build
npm ci --omit=dev
pm2 restart shift2
echo "[$(date)] Deploy finished"
