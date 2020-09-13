from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from nick_derobertis_site.api.routers import skills, awards, research, software


app = FastAPI()

origins = [
    "http://localhost",
    "http://localhost:4200",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(skills.router, prefix='/skills', tags=['skills'])
app.include_router(awards.router, prefix='/awards', tags=['awards'])
app.include_router(research.router, prefix='/research', tags=['research'])
app.include_router(software.router, prefix='/software', tags=['software'])

