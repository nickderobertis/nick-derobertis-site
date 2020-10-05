FROM ubuntu:20.04

WORKDIR /home/docker

# The enviroment variable ensures that the python output is set straight
# to the terminal without buffering it first
ENV PYTHONUNBUFFERED 1

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    curl git texlive texlive-luatex texlive-science texlive-latex-extra \
    texlive-plain-generic texlive-extra-utils nginx openssh-server \
    python3.8-dev python3.8-distutils python3-pip
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install -y nodejs
RUN npm install -g @angular/cli json-schema-to-typescript
RUN mkdir -p /var/run/sshd

RUN python3.8 -m pip install pipenv

COPY Pipfile .
COPY Pipfile.lock .

RUN pipenv sync

EXPOSE 80 22

COPY . .

RUN pipenv run ./build.sh

WORKDIR /home/docker/frontend/nick-derobertis-site

RUN npm install
RUN npm run build:ssr

WORKDIR /home/docker

ENTRYPOINT [ "./entrypoint.sh"]