import uuid

from tests.conftest import RESOURCE, auth


def test_无token返回401(make_client):
    client = make_client()
    resp = client.post("/events", json={"eventId": str(uuid.uuid4())})
    assert resp.status_code == 401


def test_过期token返回401(make_client, token_factory):
    client = make_client()
    token = token_factory(sub="player-1", exp_delta=-60)
    resp = client.post("/events", json={"eventId": str(uuid.uuid4())}, headers=auth(token))
    assert resp.status_code == 401


def test_aud错误返回401(make_client, token_factory):
    client = make_client()
    token = token_factory(sub="player-1", aud="not-" + RESOURCE)
    resp = client.post("/events", json={"eventId": str(uuid.uuid4())}, headers=auth(token))
    assert resp.status_code == 401
