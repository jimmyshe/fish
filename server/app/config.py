import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    pocket_id_issuer: str
    jwks_url: str
    userinfo_url: str
    api_resource: str
    required_scope: str
    db_path: str
    rate_limit_per_minute: int

    @classmethod
    def from_env(cls) -> "Settings":
        issuer = os.environ.get("FISH_POCKETID_ISSUER")
        if not issuer:
            raise RuntimeError("缺少必填环境变量 FISH_POCKETID_ISSUER")
        resource = os.environ.get("FISH_API_RESOURCE")
        if not resource:
            raise RuntimeError("缺少必填环境变量 FISH_API_RESOURCE")
        return cls(
            pocket_id_issuer=issuer,
            jwks_url=os.environ.get("FISH_JWKS_URL", f"{issuer}/.well-known/jwks.json"),
            userinfo_url=os.environ.get("FISH_USERINFO_URL", f"{issuer}/api/oidc/userinfo"),
            api_resource=resource,
            required_scope=os.environ.get("FISH_REQUIRED_SCOPE", "fish:play"),
            db_path=os.environ.get("FISH_DB_PATH", "server/data/fish.db"),
            rate_limit_per_minute=int(os.environ.get("FISH_RATE_LIMIT_PER_MINUTE", "30")),
        )
