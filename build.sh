#! /bin/bash

sass nick_derobertis_site/styles.scss nick_derobertis_site/styles.css
python -m nick_derobertis_site.gen_content.pdfs
./scripts/setup-panel-extensions.sh