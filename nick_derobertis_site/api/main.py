import os

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from nick_derobertis_site.api.routers import (
    awards,
    courses,
    research,
    skills,
    software,
    timeline,
)
from nick_derobertis_site.logger import logger

ENVIRONMENT_NAME = os.environ.get("NDS_ENVIRONMENT_NAME", "development")
SENTRY_DSN = os.environ.get("BE_SENTRY_DSN", "")

logger.info(f"Starting API in environment {ENVIRONMENT_NAME}")

if SENTRY_DSN:
    sentry_sdk.init(SENTRY_DSN, traces_sample_rate=1.0)
    logger.info(f"Sentry started with DSN: {SENTRY_DSN}")


app = FastAPI()

origins = [
    "http://localhost",
    "http://localhost:4000",
    "http://localhost:4200",
    "http://nickderobertis.com",
    "https://nickderobertis.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(skills.router, prefix="/skills", tags=["skills"])
app.include_router(awards.router, prefix="/awards", tags=["awards"])
app.include_router(research.router, prefix="/research", tags=["research"])
app.include_router(software.router, prefix="/software", tags=["software"])
app.include_router(courses.router, prefix="/courses", tags=["courses"])
app.include_router(timeline.router, prefix="/timeline", tags=["timeline"])
