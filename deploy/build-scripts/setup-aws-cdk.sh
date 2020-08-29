#!/bin/bash



set -e;

# Create a project directory
mkdir deploy-cdk
# Enter the directory
cd deploy-cdk
# Use the CDK CLI to initiate a Python CDK project
cdk init --language python
# Activate Python virtual environment
source .env/bin/activate
# Install CDK Python general dependencies
pip install -r requirements.txt
# Install CDK Python ECS dependencies
pip install aws_cdk.aws_ec2 aws_cdk.aws_ecs aws_cdk.aws_iam boto3 pydantic jinja2

# Clean up unnecessary git repo
rm -rf .git

cd ..
build-scripts/post-setup-aws-cdk.sh