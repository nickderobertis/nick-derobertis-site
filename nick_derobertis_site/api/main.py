from fastapi import FastAPI
from nick_derobertis_site.api.routers import skills


app = FastAPI()


app.include_router(skills.router, prefix='/skills', tags=['skills'])

