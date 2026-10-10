import tomllib
from pathlib import Path

# 版本唯一来源：pyproject.toml 的 project.version
PYPROJECT_VERSION = tomllib.loads(
    (Path(__file__).parent.parent / "pyproject.toml").read_text(encoding="utf-8")
)["project"]["version"]


def test_health无需鉴权(make_client):
    client = make_client()
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "version": PYPROJECT_VERSION}
