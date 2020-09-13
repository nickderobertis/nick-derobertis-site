from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from nick_derobertis_site.api.routers import skills


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

