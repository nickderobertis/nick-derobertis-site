FROM python:3.7-slim

WORKDIR /home/docker

# The enviroment variable ensures that the python output is set straight
# to the terminal without buffering it first
ENV PYTHONUNBUFFERED 1

ENV DEBIAN_FRONTEND=noninteractive

RUN pip install pipenv

RUN apt-get update && apt-get install -y \
    curl git texlive texlive-luatex texlive-science texlive-latex-extra \
    nginx openssh-server
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install -y nodejs
RUN npm install -g @angular/cli json-schema-to-typescript
RUN mkdir -p /var/run/sshd

COPY Pipfile .
COPY Pipfile.lock .

RUN pipenv sync

EXPOSE 80 22

COPY . .

RUN pipenv run ./build.sh

WORKDIR /home/docker/frontend/nick-derobertis-site

RUN npm run build:ssr

WORKDIR /home/docker

ENTRYPOINT [ "./entrypoint.sh"]