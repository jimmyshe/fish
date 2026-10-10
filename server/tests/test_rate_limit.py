import uuid

from tests.conftest import auth


def test_超过每玩家每分钟限额返回429(make_client, token_factory):
    client = make_client(rate_limit=3)
    token = token_factory(sub="player-1")

    for _ in range(3):
        resp = client.post("/events", json={"eventId": str(uuid.uuid4())}, headers=auth(token))
        assert resp.status_code == 204

    resp = client.post("/events", json={"eventId": str(uuid.uuid4())}, headers=auth(token))
    assert resp.status_code == 429

    me = client.get("/me", headers=auth(token))
    assert me.json()["count"] == 3
