FROM python:3.7-slim

WORKDIR /home/docker

# The enviroment variable ensures that the python output is set straight
# to the terminal without buffering it first
ENV PYTHONUNBUFFERED 1

ENV DEBIAN_FRONTEND=noninteractive

RUN pip install pipenv

RUN apt-get update && apt-get install -y curl git texlive texlive-luatex texlive-science texlive-latex-extra
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install -y nodejs
RUN npm install -g sass

COPY Pipfile .
COPY Pipfile.lock .

RUN pipenv sync

ENV BOKEH_ALLOW_WS_ORIGIN=localhost,nickderobertis.com,www.nickderobertis.com,85a22048de9a.ngrok.io
ENV BOKEH_RESOURCES=cdn

EXPOSE 80

COPY . .

RUN pipenv run ./build.sh

ENTRYPOINT [ "pipenv", "run", "python", "nick_derobertis_site/home.py"]