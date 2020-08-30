#!/bin/bash

SSH_PUBLIC_KEY=$(cat ./deploy/id_rsa.pub);

docker run -p 80:80 -p 22:22 -e "SSH_PUBLIC_KEY=$SSH_PUBLIC_KEY" nick-derobertis-site