import json
from typing import NamedTuple

import httpx
import jwt
from jwt import PyJWTError


class AuthError(Exception):
    pass


class Identity(NamedTuple):
    claims: dict
    token: str


class JwksClient:
    """JWKS 拉取与按 kid 缓存；未命中时刷新一次。"""

    def __init__(self, jwks_url: str):
        self.jwks_url = jwks_url
        self._jwks: dict[str, dict] = {}

    def _fetch(self) -> None:
        resp = httpx.get(self.jwks_url, timeout=5)
        resp.raise_for_status()
        self._jwks = {k["kid"]: k for k in resp.json().get("keys", [])}

    def get_key(self, kid: str | None):
        if kid is None:
            raise AuthError("token 缺少 kid")
        if kid not in self._jwks:
            self._fetch()
        if kid not in self._jwks:
            self._fetch()
        jwk = self._jwks.get(kid)
        if jwk is None:
            raise AuthError(f"未知 kid: {kid}")
        return jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(jwk))


def decode_token(token: str, settings, jwks_client: JwksClient) -> dict:
    try:
        header = jwt.get_unverified_header(token)
        key = jwks_client.get_key(header.get("kid"))
        claims = jwt.decode(
            token,
            key=key,
            algorithms=["RS256"],
            issuer=settings.pocket_id_issuer,
            audience=settings.api_resource,
        )
    except (PyJWTError, AuthError, KeyError, httpx.HTTPError) as exc:
        raise AuthError(str(exc)) from exc
    if settings.required_scope not in claims.get("scope", "").split():
        raise AuthError("scope 不足")
    return claims


def fetch_username(token: str, settings) -> str | None:
    """调 PocketID userinfo 取用户名；任何失败（网络错误/非 200）返回 None，由调用方回退 sub。"""
    try:
        resp = httpx.get(
            settings.userinfo_url,
            headers={"Authorization": f"Bearer {token}"},
            timeout=5,
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
    except (httpx.HTTPError, ValueError):
        return None
    return data.get("preferred_username") or data.get("name") or None
