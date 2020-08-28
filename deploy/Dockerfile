FROM python:3.7

WORKDIR /home/docker

COPY build-scripts build-scripts

RUN build-scripts/install-awscli.sh
RUN build-scripts/install-nodejs.sh
RUN build-scripts/install-aws-cdk.sh

COPY cdk_files cdk_files

COPY entrypoint.sh .

ENTRYPOINT ["/home/docker/entrypoint.sh"]
CMD ["bash"]