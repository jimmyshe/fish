import uuid

from tests.conftest import auth


def _post_events(client, token, n):
    for _ in range(n):
        resp = client.post("/events", json={"eventId": str(uuid.uuid4())}, headers=auth(token))
        assert resp.status_code == 204


def _setup_players(make_client, token_factory):
    for sub, username in [("player-a", "anna"), ("player-b", "bob"), ("player-c", "carol")]:
        make_client.stub_userinfo(sub, body={"preferred_username": username})
    client = make_client()
    token_a = token_factory(sub="player-a")
    token_b = token_factory(sub="player-b")
    token_c = token_factory(sub="player-c")
    _post_events(client, token_a, 3)
    _post_events(client, token_b, 1)
    _post_events(client, token_c, 2)
    return client, token_a, token_b, token_c


def test_排行榜按计数降序排序(make_client, token_factory):
    client, _, token_b, _ = _setup_players(make_client, token_factory)

    resp = client.get("/leaderboard", headers=auth(token_b))
    assert resp.status_code == 200
    entries = resp.json()["entries"]
    assert [(e["username"], e["count"]) for e in entries] == [
        ("anna", 3),
        ("carol", 2),
        ("bob", 1),
    ]
    assert [e["rank"] for e in entries] == [1, 2, 3]
    assert resp.json()["me"] == {"rank": 3, "count": 1}


def test_optout玩家不上榜但本人名次仍给出(make_client, token_factory):
    client, _, _, token_c = _setup_players(make_client, token_factory)

    resp = client.put(
        "/me/preferences", json={"showOnLeaderboard": False}, headers=auth(token_c)
    )
    assert resp.status_code == 200

    resp = client.get("/leaderboard", headers=auth(token_c))
    entries = resp.json()["entries"]
    assert [e["username"] for e in entries] == ["anna", "bob"]
    assert resp.json()["me"] == {"rank": 2, "count": 2}

    me = client.get("/me", headers=auth(token_c))
    assert me.json()["showOnLeaderboard"] is False
    assert me.json()["rank"] == 2
