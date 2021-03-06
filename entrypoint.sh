#!/bin/bash

if [ -z "$SSH_PUBLIC_KEY" ]; then
  echo "Need your SSH public key as the SSH_PUBLIC_KEY env variable."
  exit 1
fi

echo "Setting up nginx config"
./container-scripts/setup-nginx-config.sh

echo "Setting up SSH config"
# Create a folder to store user's SSH keys if it does not exist.
USER_SSH_KEYS_FOLDER=~/.ssh
[ ! -d "$USER_SSH_KEYS_FOLDER" ] && mkdir -p $USER_SSH_KEYS_FOLDER

# Copy contents from the `SSH_PUBLIC_KEY` environment variable
# to the `${USER_SSH_KEYS_FOLDER}/authorized_keys` file.
# The environment variable must be set when the container starts.
echo "$SSH_PUBLIC_KEY" > ${USER_SSH_KEYS_FOLDER}/authorized_keys

# Clear the `SSH_PUBLIC_KEY` environment variable.
unset SSH_PUBLIC_KEY

# Start the SSH daemon.
echo "Starting SSH daemon"
/usr/sbin/sshd

echo "Starting nginx"
nginx;

echo "Starting backend"
pipenv run uvicorn nick_derobertis_site.api.main:app --host 0.0.0.0 &

echo "Starting frontend"
cd frontend/nick-derobertis-site
npm run serve:ssr
