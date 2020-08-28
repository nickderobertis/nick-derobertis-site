#!/bin/bash

DEPLOY_FOLDER=deploy-cdk

if [ -d "$DEPLOY_FOLDER" ]
then
    echo "Directory $DEPLOY_FOLDER exists, will not run CDK init";
    build-scripts/post-setup-aws-cdk.sh
else
    echo "Directory $DEPLOY_FOLDER not found, running CDK init.";
    build-scripts/setup-aws-cdk.sh;
fi

source deploy-cdk/.env/bin/activate;

exec "$@";