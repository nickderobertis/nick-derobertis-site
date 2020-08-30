#!/bin/bash

ENV_NAME=${1:-prod}

python -m copy_env $ENV_NAME

./run-docker.sh bash -c "cd deploy-cdk && cdk deploy route53 && cd .. && python -m cdk_files.update_name_servers && cd deploy-cdk && cdk deploy nick-derobertis-site"