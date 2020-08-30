#!/bin/bash

./run-docker.sh bash -c "cd deploy-cdk && cdk deploy route53 && cd .. && python -m cdk_files.update_name_servers && cd deploy-cdk && cdk deploy nick-derobertis-site"