from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    DATABASE_URL: str = "mysql+pymysql://oly:oly_pass@localhost:3306/oly_db"
    # Sin default: en producción debe venir por variable de entorno. En desarrollo
    # lo provee el archivo .env (ver .env.example).
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    # Vida del refresh token (días). Permite renovar el access token sin volver a
    # iniciar sesión, manteniendo corta la vida del token de acceso.
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    # Orígenes permitidos para CORS, separados por coma.
    CORS_ORIGINS: str = "http://localhost:3000"
    # Rate limiting de autenticación (por IP, ventana deslizante en memoria).
    RATE_LIMIT_LOGIN_MAX: int = 10
    RATE_LIMIT_REGISTER_MAX: int = 5
    RATE_LIMIT_WINDOW_SECONDS: int = 60
    # URL pública del frontend. Se usa para los links dentro de los correos
    # (p. ej. /reset-password, /pedidos).
    APP_URL: str = "http://localhost:3000"
    # SMTP. Si SMTP_HOST o SMTP_USER están vacíos, `smtp_configured` es False y
    # el motor de correos registra el envío en el log sin contactar ningún servidor.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_USE_TLS: bool = True

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def smtp_configured(self) -> bool:
        return bool(self.SMTP_HOST and self.SMTP_USER)

    class Config:
        env_file = ".env"


settings = Settings()
