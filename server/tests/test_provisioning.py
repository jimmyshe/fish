import uuid

from tests.conftest import auth


def _leaderboard_usernames(client, token):
    resp = client.get("/leaderboard", headers=auth(token))
    assert resp.status_code == 200
    return [e["username"] for e in resp.json()["entries"]]


def test_首次上报自动建档用户名取userinfo的preferred_username(make_client, token_factory):
    client = make_client()
    token = token_factory(sub="player-new", preferred_username=None, name=None)
    make_client.stub_userinfo("player-new", body={"preferred_username": "anna"})
    client.post("/events", json={"eventId": str(uuid.uuid4())}, headers=auth(token))
    assert "anna" in _leaderboard_usernames(client, token)


def test_用户名缺preferred_username时取userinfo的name(make_client, token_factory):
    client = make_client()
    token = token_factory(sub="player-new", preferred_username=None, name=None)
    make_client.stub_userinfo("player-new", body={"name": "Bob Smith"})
    client.post("/events", json={"eventId": str(uuid.uuid4())}, headers=auth(token))
    assert "Bob Smith" in _leaderboard_usernames(client, token)


def test_userinfo两个字段都缺时取sub(make_client, token_factory):
    client = make_client()
    token = token_factory(sub="player-new", preferred_username=None, name=None)
    make_client.stub_userinfo("player-new", body={})
    client.post("/events", json={"eventId": str(uuid.uuid4())}, headers=auth(token))
    assert "player-new" in _leaderboard_usernames(client, token)
