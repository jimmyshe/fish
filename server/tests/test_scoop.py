import uuid

from tests.conftest import auth


def test_上报事件后本人计数为1(make_client, token_factory):
    client = make_client()
    token = token_factory(sub="player-1")

    resp = client.post("/events", json={"eventId": str(uuid.uuid4())}, headers=auth(token))
    assert resp.status_code == 204

    me = client.get("/me", headers=auth(token))
    assert me.status_code == 200
    assert me.json()["count"] == 1


def test_相同eventId重发计数不变(make_client, token_factory):
    client = make_client()
    token = token_factory(sub="player-1")
    event_id = str(uuid.uuid4())

    for _ in range(3):
        resp = client.post("/events", json={"eventId": event_id}, headers=auth(token))
        assert resp.status_code == 204

    me = client.get("/me", headers=auth(token))
    assert me.json()["count"] == 1
