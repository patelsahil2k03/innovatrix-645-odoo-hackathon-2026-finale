"""Typed configuration, read once from the environment / .env file."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Hackathon API"
    app_version: str = "0.1.0"
    api_prefix: str = "/api/v1"

    # SQLite by default: zero setup, no Docker, survives bad venue wifi.
    # Switch to Postgres by setting DATABASE_URL — nothing else changes.
    #   postgresql+psycopg://app:app@localhost:5432/app
    database_url: str = "sqlite:///./app.db"

    # Demo-grade defaults. Fine for a hackathon; rotate for anything real.
    jwt_secret: str = "dev-only-change-me-before-anything-real"
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 60 * 24

    auth_cookie_name: str = "access_token"
    auth_cookie_secure: bool = False  # True requires HTTPS; keep False on localhost

    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
    ]

    # The background "dynamic data" task. Off in tests, on for demos.
    simulator_enabled: bool = False
    simulator_interval_seconds: float = 4.0

    seed_password: str = "Demo@1234"

    # The two tax accounts a posting needs but no contact, product or journal
    # owns. 06_BACKEND.md §3 says accounts come from the data rather than from a
    # constant — receivable/payable off the contact, income/expense off the
    # product, bank/cash off the journal. Tax has no such owner, so instead of
    # burying a literal in the posting code it is named here as configuration,
    # matching the codes seeded in 03_DATA_MODEL.md §8. A deployment with a
    # different chart of accounts changes these; the posting rules do not move.
    input_tax_account_code: str = "1200"
    output_tax_account_code: str = "2100"

    # Outbound mail. Unset by default: `send` then returns MAIL_NOT_CONFIGURED
    # explicitly rather than pretending to have sent something.
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    mail_from: str = "accounts@urbanfurniture.in"

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    return Settings()
