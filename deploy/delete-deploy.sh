#!/bin/bash

./run-docker.sh bash -c "python -m cdk_files.pre_delete_cdk && cd deploy-cdk && cdk destroy nick-derobertis-site && cdk destroy route53"