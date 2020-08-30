#!/bin/bash

./container-scripts/setup-nginx-config.sh

nginx;

pipenv run python nick_derobertis_site/home.py