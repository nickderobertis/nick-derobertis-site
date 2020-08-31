#!/bin/bash

rm -rf awesome_panel_extensions
git clone --single-branch --branch templated-components https://github.com/nickderobertis/awesome-panel-extensions.git
cd awesome-panel-extensions/awesome_panel_extensions
npm install
bokeh build
cd ..
mv awesome_panel_extensions ..
cd ..
rm -rf awesome-panel-extensions
