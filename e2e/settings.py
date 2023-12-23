
from pydantic import BaseSettings


class Settings(BaseSettings):
    url: str
    default_timeout: int = 30000

    class Config:
        env_file = ".env"
        env_prefix = "E2E_"


SETTINGS = Settings()

print(
    f"Settings loaded with\n\t"
    f"url={SETTINGS.url}\n\t"
    f"default_timeout={SETTINGS.default_timeout}\n\t"
)

if __name__ == "__main__":
    print(SETTINGS)
