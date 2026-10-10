import uuid

from tests.conftest import auth


def test_建档时用户名取自userinfo的preferred_username(make_client, token_factory):
    client = make_client()
    # token 里的 preferred_username 故意与 userinfo 不同，证明用户名来自 userinfo 而非 token
    token = token_factory(sub="player-new", preferred_username="token-name")
    make_client.stub_userinfo("player-new", body={"preferred_username": "userinfo-name"})

    client.post("/events", json={"eventId": str(uuid.uuid4())}, headers=auth(token))

    resp = client.get("/leaderboard", headers=auth(token))
    assert [e["username"] for e in resp.json()["entries"]] == ["userinfo-name"]


def test_userinfo失败时建档仍成功用户名回退sub(make_client, token_factory):
    client = make_client()
    token = token_factory(sub="player-new", preferred_username="token-name")
    make_client.stub_userinfo("player-new", status=500)

    resp = client.post("/events", json={"eventId": str(uuid.uuid4())}, headers=auth(token))
    assert resp.status_code == 204

    lb = client.get("/leaderboard", headers=auth(token))
    assert [e["username"] for e in lb.json()["entries"]] == ["player-new"]
    assert client.get("/me", headers=auth(token)).json()["count"] == 1


def test_userinfo仅在建档时调用(make_client, token_factory):
    client = make_client()
    token = token_factory(sub="player-new")
    make_client.stub_userinfo("player-new", body={"preferred_username": "anna"})

    for _ in range(3):
        client.post("/events", json={"eventId": str(uuid.uuid4())}, headers=auth(token))
    client.get("/me", headers=auth(token))
    client.get("/leaderboard", headers=auth(token))

    assert make_client.userinfo_route.call_count == 1
