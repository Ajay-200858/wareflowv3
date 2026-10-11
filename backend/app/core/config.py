from pydantic_settings import BaseSettings
from typing import List, Optional
import os

class Settings(BaseSettings):
    APP_ENV: str = "development"
    API_V1_STR: str = "/api"
    
    DB_HOST: str = "localhost"
    DB_PORT: str = "3306"
    DB_NAME: str = "wareflow"
    DB_USER: str = "root"
    DB_PASSWORD: str = ""
    
    JWT_SECRET: str = "supersecretjwtkeyforwareflow12345"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    
    CORS_ORIGINS: str = "http://127.0.0.1:5500,http://localhost:5500,http://127.0.0.1:5501,http://localhost:5501,http://localhost:8000,http://localhost:8080,http://127.0.0.1:8080"
    
    ML_MODEL_DIR: str = "./ml_models"

    # Caspian Notification Gateway
    CASPIAN_API_KEY: Optional[str] = None
    CASPIAN_BASE_URL: str = "https://api.trycaspianai.com"
    CASPIAN_CHANNEL: Optional[str] = None
    CASPIAN_TIMEOUT_SECONDS: float = 5.0
    CASPIAN_RETRY_ATTEMPTS: int = 3

    # Channels & Bots
    TELEGRAM_BOT_TOKEN: Optional[str] = None
    DISCORD_BOT_TOKEN: Optional[str] = None

    # WareFlow Agent Settings
    WAREFLOW_COMPANY: Optional[str] = "cold_storage_co"
    WAREFLOW_EVENT_INTERVAL: Optional[int] = 15
    WAREFLOW_URGENCY_THRESHOLD: Optional[int] = 50

    class Config:
        env_file = ".env"
        env_file_encoding = 'utf-8'
        extra = "ignore"

    @property
    def database_url(self) -> str:
        import urllib.parse
        password_part = f":{urllib.parse.quote_plus(self.DB_PASSWORD)}" if self.DB_PASSWORD else ""
        return f"mysql+pymysql://{self.DB_USER}{password_part}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        
    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

settings = Settings()
