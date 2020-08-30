#!/bin/bash

# Replace generated files with those in source control
cp cdk_files/app.py deploy-cdk/app.py
cp cdk_files/deploy_cdk_stack.py deploy-cdk/deploy_cdk/deploy_cdk_stack.py
cp cdk_files/config.py deploy-cdk/deploy_cdk/config.py
cp cdk_files/config.py deploy-cdk/config.py
cp cdk_files/create_ssh_key.py deploy-cdk/create_ssh_key.py