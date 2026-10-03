from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    token_dir: Path = Path("data/tokens")
    cors_origins: str = "http://localhost:4200"
    mfa_ttl_seconds: int = 600
    open_wearables_url: str = "http://localhost:8000"
    open_wearables_api_key: str = ""
    user_map_file: Path = Path("data/ow_users.json")
    cache_dir: Path = Path("data/cache")
    fitatu_token_dir: Path = Path("data/fitatu")
    fitatu_api_url: str = "https://pl-pl.fitatu.com/api"
    # Fitatu's mobile app identifies itself with these; there is no developer program to get our own.
    fitatu_api_key: str = "FITATU-MOBILE-APP"
    fitatu_api_secret: str = "PYRXtfs88UDJMuCCrNpLV"
    # AI food rating. Without a key the frontend falls back to a rough estimate.
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"
    gemini_api_url: str = "https://generativelanguage.googleapis.com/v1beta"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
