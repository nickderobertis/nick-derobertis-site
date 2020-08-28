FROM python:3.7

WORKDIR /home/docker

COPY build-scripts build-scripts

RUN build-scripts/install-awscli.sh

ENTRYPOINT 'bash'