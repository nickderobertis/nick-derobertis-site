[![](https://codecov.io/gh/nickderobertis/nick-derobertis-site/branch/master/graph/badge.svg)](https://codecov.io/gh/nickderobertis/nick-derobertis-site)
[![PyPI](https://img.shields.io/pypi/v/nick-derobertis-site)](https://pypi.org/project/nick-derobertis-site/)
![PyPI - License](https://img.shields.io/pypi/l/nick-derobertis-site)
[![Documentation](https://img.shields.io/badge/documentation-pass-green)](https://nickderobertis.github.io/nick-derobertis-site/)
![Tests Run on Ubuntu Python Versions](https://img.shields.io/badge/Tests%20Ubuntu%2FPython-3.10-blue)
[![Github Repo](https://img.shields.io/badge/repo-github-informational)](https://github.com/nickderobertis/nick-derobertis-site/)

# Nick DeRobertis' Personal Website

# nick-derobertis-site

## Overview

Nick DeRobertis' Personal Website, built with Python, Panel, Bootstrap, and jQuery.

## Links

See the website
[at nickderobertis.com.](https://nickderobertis.com)

# Developing

## Backend Development

Run `just dev-be` to run the backend server.

## Frontend Development

Run `just dev-fe` to run the frontend server. You may need to
cd into the frontend/nick-derobertis-site directory and run `pnpm i` first.

## QA

Make sure you have Docker installed.

Run `just qa` to start a production-like
build. Run `./stop-docker.sh` to stop.

## Development Status

This project is currently in early-stage development. There may be
breaking changes often. While the major version is 0, minor version
upgrades will often have breaking changes.

## Developing

See the [development guide](https://github.com/nickderobertis/nick-derobertis-site/blob/master/DEVELOPING.md) for development details.

## Author

Created by Nick DeRobertis. MIT License.
