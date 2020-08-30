#!/bin/bash

MAIN_DEPLOY_NAME=$(python -m cdk_files.config -g names.app)
ROUTE53_DEPLOY_NAME=$(python -m cdk_files.config -g names.route53_stack)

echo "Deploying $MAIN_DEPLOY_NAME and $ROUTE53_DEPLOY_NAME"

cd deploy-cdk
python -m create_ssh_key
cp id_rsa ..
cp id_rsa.pub ..
cdk deploy $ROUTE53_DEPLOY_NAME
cd ..
python -m cdk_files.update_name_servers
cd deploy-cdk
cdk deploy $MAIN_DEPLOY_NAME