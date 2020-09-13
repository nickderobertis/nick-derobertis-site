#!/bin/bash

for API_NAME in skills awards
do
  python -m pydantic2ts.cli.script \
  --module nick_derobertis_site.api.routers.$API_NAME \
  --output frontend/nick-derobertis-site/src/app/global/interfaces/generated/$API_NAME.ts
done

