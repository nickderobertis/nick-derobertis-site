#!/bin/bash

source ./.env.sh || echo "No .env.sh file found"

docker run -p 80:80 -p 22:22 \
  -e "NDS_ENVIRONMENT_NAME=$NDS_ENVIRONMENT_NAME" \
  -e "BE_SENTRY_DSN=$BE_SENTRY_DSN" \
  nick-derobertis-site