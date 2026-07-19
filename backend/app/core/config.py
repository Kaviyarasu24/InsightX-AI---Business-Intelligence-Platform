from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = 'InsightX AI API'
    api_v1_prefix: str = '/api/v1'
    cors_origins: list[str] = ['http://localhost:5173', 'http://127.0.0.1:5173']
    uploads_dir: Path = Path(__file__).resolve().parents[2] / 'uploads'
    openrouter_api_key: str = ""

    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    return settings


settings = get_settings()
