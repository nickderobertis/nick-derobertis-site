
[![](https://codecov.io/gh/nickderobertis/nick-derobertis-site/branch/master/graph/badge.svg)](https://codecov.io/gh/nickderobertis/nick-derobertis-site)

# Nick DeRobertis' Personal Website

## Overview

Nick DeRobertis' Personal Website, built with Python, Panel, Bootstrap, and jQuery.


## Links

See the website
[at nickderobertis.com.](
https://nickderobertis.com
)

# Developing

## Backend Development

Make sure you have `pipenv` install and run `pipenv sync`.

Run `./run-be-local.sh` to start the backend server.

## Frontend Development

Make sure you have `npm` installed and run `npm install`.

Run `npm run dev:ssr` to start the frontend server.

## QA

Make sure you have Docker installed.

Run `./build-docker.sh && ./run-docker.sh` to start a production-like 
build. Run `./stop-docker.sh` to stop.

## Author

Created by Nick DeRobertis. MIT License.