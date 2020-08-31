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
RUN npm install -g sass
RUN mkdir -p /var/run/sshd

COPY Pipfile .
COPY Pipfile.lock .

RUN pipenv sync

ENV BOKEH_ALLOW_WS_ORIGIN=localhost,nickderobertis.com,www.nickderobertis.com,ts-lb-1673545034.us-west-1.elb.amazonaws.com

EXPOSE 80 5100 22

COPY . .

RUN pipenv run ./build.sh

ENTRYPOINT [ "./entrypoint.sh"]