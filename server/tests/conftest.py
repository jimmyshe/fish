import json
import time
import uuid

import httpx
import jwt
import pytest
import respx
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

ISSUER = "https://pocketid.test"
JWKS_URL = f"{ISSUER}/.well-known/jwks.json"
USERINFO_URL = f"{ISSUER}/api/oidc/userinfo"
RESOURCE = "fish-api"
KID = "test-kid"


@pytest.fixture(scope="session")
def rsa_keys():
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(private_key.public_key()))
    jwk.update({"kid": KID, "alg": "RS256", "use": "sig"})
    return private_key, {"keys": [jwk]}


@pytest.fixture(scope="session")
def token_factory(rsa_keys):
    private_key, _ = rsa_keys

    def make_token(
        sub="player-1",
        preferred_username="alice",
        name=None,
        scope="fish:play",
        aud=RESOURCE,
        iss=ISSUER,
        exp_delta=3600,
    ):
        now = int(time.time())
        claims = {
            "sub": sub,
            "iss": iss,
            "aud": aud,
            "scope": scope,
            "iat": now,
            "exp": now + exp_delta,
        }
        if preferred_username is not None:
            claims["preferred_username"] = preferred_username
        if name is not None:
            claims["name"] = name
        return jwt.encode(claims, private_key, algorithm="RS256", headers={"kid": KID})

    return make_token


@pytest.fixture
def make_client(rsa_keys, tmp_path):
    _, jwks = rsa_keys
    # sub -> (status_code, json body)；未登记的 sub 默认 200 空 body（回退 sub 作为用户名）
    userinfo_responses: dict[str, tuple[int, dict]] = {}

    def userinfo_handler(request: httpx.Request) -> httpx.Response:
        token = request.headers["Authorization"].removeprefix("Bearer ")
        sub = jwt.decode(token, options={"verify_signature": False})["sub"]
        status, body = userinfo_responses.get(sub, (200, {}))
        return httpx.Response(status, json=body)

    with respx.mock:
        respx.get(JWKS_URL).respond(json=jwks)
        userinfo_route = respx.get(USERINFO_URL).mock(side_effect=userinfo_handler)

        def _make_client(rate_limit=30):
            settings = Settings(
                pocket_id_issuer=ISSUER,
                jwks_url=JWKS_URL,
                userinfo_url=USERINFO_URL,
                api_resource=RESOURCE,
                required_scope="fish:play",
                db_path=str(tmp_path / f"fish-{uuid.uuid4().hex}.db"),
                rate_limit_per_minute=rate_limit,
            )
            return TestClient(create_app(settings))

        def _stub_userinfo(sub, status=200, body=None):
            userinfo_responses[sub] = (status, body or {})

        _make_client.stub_userinfo = _stub_userinfo
        _make_client.userinfo_route = userinfo_route
        yield _make_client


def auth(token):
    return {"Authorization": f"Bearer {token}"}
