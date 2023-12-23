#!/bin/bash

echo "Setting up nginx config"
./container-scripts/setup-nginx-config.sh

echo "Starting nginx"
nginx;

echo "Starting backend"
poetry run uvicorn nick_derobertis_site.api.main:app --host 0.0.0.0 --root-path /api &

echo "Starting frontend"
cd frontend/nick-derobertis-site
npm run serve:ssr
