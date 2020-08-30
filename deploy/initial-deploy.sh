#!/bin/bash

ENV_NAME=${1:-prod}

python -m copy_env $ENV_NAME

./run-docker.sh ./container-scripts/initial-deploy.sh $ENV_NAME