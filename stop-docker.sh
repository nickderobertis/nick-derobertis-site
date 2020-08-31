#!/bin/bash

CONTAINER_ID=$(docker ps --filter "ancestor=nick-derobertis-site" --format "{{.ID}}")
docker stop $CONTAINER_ID