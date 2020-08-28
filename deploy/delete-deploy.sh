#!/bin/bash

./run-docker.sh bash -c "python cdk_files/pre_delete_cdk.py && cd deploy-cdk && cdk destroy"