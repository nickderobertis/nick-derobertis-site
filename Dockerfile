FROM python:3.11

WORKDIR /home/docker

# The enviroment variable ensures that the python output is set straight
# to the terminal without buffering it first
ENV PYTHONUNBUFFERED 1

ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_OPTIONS="--openssl-legacy-provider"

RUN apt-get update && apt-get install -y \
    curl git texlive texlive-luatex texlive-science texlive-latex-extra \
    texlive-plain-generic texlive-extra-utils nginx nodejs npm

RUN npm install -g @angular/cli json-schema-to-typescript
RUN mkdir -p /var/run/sshd

RUN python -m pip install poetry

COPY pyproject.toml .
COPY poetry.toml .
COPY poetry.lock .

RUN poetry install

EXPOSE 80

COPY . .

RUN poetry run ./build.sh

WORKDIR /home/docker/frontend/nick-derobertis-site

RUN npm install
RUN npm run build:ssr

WORKDIR /home/docker

ENTRYPOINT [ "./entrypoint.sh"]