#!/bin/bash

JSON2TS_PATH=$(which json2ts || echo "pnpm json2ts")

for API_NAME in skills awards research software courses timeline
do
  python -m pydantic2ts.cli.script \
  --module nick_derobertis_site.api.routers.$API_NAME \
  --output frontend/nick-derobertis-site/src/app/global/interfaces/generated/$API_NAME.ts \
  --json2ts-cmd "$JSON2TS_PATH"
done

