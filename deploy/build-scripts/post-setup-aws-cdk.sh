#!/bin/bash

# Replace generated files with those in source control
cp cdk_files/app.py deploy-cdk/app.py
cp cdk_files/deploy_cdk_stack.py deploy-cdk/deploy_cdk/deploy_cdk_stack.py