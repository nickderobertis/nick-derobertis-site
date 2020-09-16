#!/bin/bash

source ./.env.sh

uvicorn nick_derobertis_site.api.main:app --reload