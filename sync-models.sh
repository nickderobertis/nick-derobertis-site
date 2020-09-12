#!/bin/bash

python -m pydantic2ts.cli.script \
  --module nick_derobertis_site.api.routers.skills \
  --output frontend/nick-derobertis-site/src/app/global/interfaces/generated/skills.ts