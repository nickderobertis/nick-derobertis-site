#!/bin/bash

ENV_NAME=${1:-prod}
python -m copy_env $ENV_NAME
source ./.env
URL=${2:-$DEPLOY_URL}

KEY_PAIR=./id_rsa.$ENV_NAME
DESTINATION=root@$URL


echo "Connecting to $DESTINATION with $KEY_PAIR"

ssh -i $KEY_PAIR $DESTINATION