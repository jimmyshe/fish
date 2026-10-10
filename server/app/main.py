from uuid import UUID

from fastapi import Depends, FastAPI, Header, HTTPException, Response
from pydantic import BaseModel

from app import db
from app.auth import AuthError, Identity, JwksClient, decode_token, fetch_username
from app.config import Settings


class EventIn(BaseModel):
    eventId: UUID


class PreferencesIn(BaseModel):
    showOnLeaderboard: bool


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    db.init_db(settings.db_path)
    jwks_client = JwksClient(settings.jwks_url)
    app = FastAPI(title="fish-server")

    def current_identity(authorization: str | None = Header(default=None)) -> Identity:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401)
        token = authorization.removeprefix("Bearer ")
        try:
            claims = decode_token(token, settings, jwks_client)
        except AuthError:
            raise HTTPException(status_code=401)
        return Identity(claims=claims, token=token)

    def provision(conn, sub: str, token: str) -> None:
        # 仅在建档时调 userinfo 取用户名；PocketID 抖动时回退 sub，不阻塞建档
        if db.get_player(conn, sub) is not None:
            return
        username = fetch_username(token, settings) or sub
        db.ensure_player(conn, sub, username)

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.post("/events", status_code=204)
    def post_event(body: EventIn, identity: Identity = Depends(current_identity)):
        sub = identity.claims["sub"]
        with db.connect(settings.db_path) as conn:
            if db.recent_event_count(conn, sub, 60) >= settings.rate_limit_per_minute:
                raise HTTPException(status_code=429)
            provision(conn, sub, identity.token)
            db.record_event(conn, sub, str(body.eventId))
        return Response(status_code=204)

    def leaderboard_view(conn, sub: str) -> tuple[list[dict], dict | None]:
        # 名次在全体玩家（含 opt-out）上计算：计数降序、sub 升序保证稳定
        rows = db.all_player_counts(conn)
        ranked = [
            {"rank": i + 1, "sub": r["sub"], "username": r["username"],
             "count": r["count"], "show": bool(r["show_on_leaderboard"])}
            for i, r in enumerate(rows)
        ]
        entries = [
            {"rank": r["rank"], "username": r["username"], "count": r["count"]}
            for r in ranked if r["show"]
        ][:100]
        me = next(({"rank": r["rank"], "count": r["count"]} for r in ranked if r["sub"] == sub), None)
        return entries, me

    @app.get("/me")
    def get_me(identity: Identity = Depends(current_identity)):
        sub = identity.claims["sub"]
        with db.connect(settings.db_path) as conn:
            _, me = leaderboard_view(conn, sub)
            player = db.get_player(conn, sub)
        return {
            "count": me["count"] if me else 0,
            "rank": me["rank"] if me else None,
            "showOnLeaderboard": bool(player["show_on_leaderboard"]) if player else True,
        }

    @app.get("/leaderboard")
    def get_leaderboard(identity: Identity = Depends(current_identity)):
        with db.connect(settings.db_path) as conn:
            entries, me = leaderboard_view(conn, identity.claims["sub"])
        return {"entries": entries, "me": me or {"rank": None, "count": 0}}

    @app.put("/me/preferences")
    def put_preferences(body: PreferencesIn, identity: Identity = Depends(current_identity)):
        sub = identity.claims["sub"]
        with db.connect(settings.db_path) as conn:
            provision(conn, sub, identity.token)
            db.set_show_on_leaderboard(conn, sub, body.showOnLeaderboard)
        return {"showOnLeaderboard": body.showOnLeaderboard}

    return app
