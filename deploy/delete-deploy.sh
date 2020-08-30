#!/bin/bash

ENV_NAME=${1:-prod}

python -m copy_env $ENV_NAME

./run-docker.sh bash -c "python -m cdk_files.pre_delete_cdk && cd deploy-cdk && cdk destroy nick-derobertis-site && cdk destroy route53"