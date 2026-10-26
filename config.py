import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    app_name = "Chair on Top"
    app_env = os.getenv("APP_ENV", "development")


settings = Settings()