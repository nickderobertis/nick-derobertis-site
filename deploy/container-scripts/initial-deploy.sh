#!/bin/bash

export DEPLOY_ENVIRONMENT_NAME=${1:-prod}
MAIN_DEPLOY_NAME=$(python -m cdk_files.config -g names.app)
ROUTE53_DEPLOY_NAME=$(python -m cdk_files.config -g names.route53_stack)

echo "Deploying environment $DEPLOY_ENVIRONMENT_NAME. Stacks: $MAIN_DEPLOY_NAME and $ROUTE53_DEPLOY_NAME"

cd deploy-cdk
python -m create_ssh_key $DEPLOY_ENVIRONMENT_NAME
cp id_rsa.$DEPLOY_ENVIRONMENT_NAME ..
cp id_rsa.$DEPLOY_ENVIRONMENT_NAME.pub ..
cdk deploy $ROUTE53_DEPLOY_NAME
cd ..
python -m cdk_files.update_name_servers
cd deploy-cdk
cdk deploy $MAIN_DEPLOY_NAME