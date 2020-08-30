#!/bin/bash

MAIN_DEPLOY_NAME=$(python -m cdk_files.config -g names.app)
ROUTE53_DEPLOY_NAME=$(python -m cdk_files.config -g names.route53_stack)

echo "Destroying $MAIN_DEPLOY_NAME and $ROUTE53_DEPLOY_NAME"

python -m cdk_files.pre_delete_cdk
cd deploy-cdk
cdk destroy $MAIN_DEPLOY_NAME
cdk destroy $ROUTE53_DEPLOY_NAME
