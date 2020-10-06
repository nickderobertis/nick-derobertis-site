#! /bin/bash

set -e;

python -m nick_derobertis_site.gen_content.pdfs
./sync-models.sh