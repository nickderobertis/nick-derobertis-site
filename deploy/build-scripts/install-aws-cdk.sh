#!/bin/bash

set -e;

# Install AWS CDK
npm install -g aws-cdk
echo "Installed AWS CDK $(cdk --version)"