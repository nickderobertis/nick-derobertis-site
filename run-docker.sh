#!/bin/bash

source ./.env.sh

# TODO [#8]: auto create public key, right now requires using deployment container
SSH_PUBLIC_KEY=$(cat ./deploy/id_rsa.pub);

docker run -p 80:80 -p 22:22 \
  -e "SSH_PUBLIC_KEY=$SSH_PUBLIC_KEY" \
  -e "NDS_ENVIRONMENT_NAME=$NDS_ENVIRONMENT_NAME" \
  -e "BE_SENTRY_DSN=$BE_SENTRY_DSN" \
  nick-derobertis-site