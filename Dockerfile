FROM python:3.7

WORKDIR /home/docker

# The enviroment variable ensures that the python output is set straight
# to the terminal without buffering it first
ENV PYTHONUNBUFFERED 1

RUN pip install pipenv

RUN curl -sL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install -y nodejs

COPY Pipfile .
COPY Pipfile.lock .

RUN pipenv sync

ENV BOKEH_ALLOW_WS_ORIGIN=localhost,nickderobertis.com,www.nickderobertis.com,85a22048de9a.ngrok.io
ENV BOKEH_RESOURCES=cdn

EXPOSE 80

COPY . .

ENTRYPOINT [ "pipenv", "run", "python", "nick_derobertis_site/home.py"]