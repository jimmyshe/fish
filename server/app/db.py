import os
import sqlite3
import time

SCHEMA = """
CREATE TABLE IF NOT EXISTS players (
    sub TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    show_on_leaderboard INTEGER NOT NULL DEFAULT 1,
    created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS scoop_events (
    event_id TEXT NOT NULL,
    player_sub TEXT NOT NULL REFERENCES players(sub),
    created_at REAL NOT NULL,
    PRIMARY KEY (event_id, player_sub)
);
CREATE INDEX IF NOT EXISTS idx_events_player_time ON scoop_events(player_sub, created_at);
"""


def connect(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: str) -> None:
    parent = os.path.dirname(db_path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with connect(db_path) as conn:
        conn.executescript(SCHEMA)


def ensure_player(conn: sqlite3.Connection, sub: str, username: str) -> None:
    conn.execute(
        "INSERT OR IGNORE INTO players(sub, username, show_on_leaderboard, created_at)"
        " VALUES (?, ?, 1, ?)",
        (sub, username, time.time()),
    )


def record_event(conn: sqlite3.Connection, sub: str, event_id: str) -> None:
    conn.execute(
        "INSERT OR IGNORE INTO scoop_events(event_id, player_sub, created_at) VALUES (?, ?, ?)",
        (event_id, sub, time.time()),
    )


def count_events(conn: sqlite3.Connection, sub: str) -> int:
    row = conn.execute(
        "SELECT COUNT(*) AS c FROM scoop_events WHERE player_sub = ?", (sub,)
    ).fetchone()
    return row["c"]


def recent_event_count(conn: sqlite3.Connection, sub: str, window_seconds: float) -> int:
    row = conn.execute(
        "SELECT COUNT(*) AS c FROM scoop_events WHERE player_sub = ? AND created_at > ?",
        (sub, time.time() - window_seconds),
    ).fetchone()
    return row["c"]


def all_player_counts(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT p.sub, p.username, p.show_on_leaderboard, COUNT(e.event_id) AS count
        FROM players p
        LEFT JOIN scoop_events e ON e.player_sub = p.sub
        GROUP BY p.sub
        ORDER BY count DESC, p.sub ASC
        """
    ).fetchall()


def get_player(conn: sqlite3.Connection, sub: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM players WHERE sub = ?", (sub,)).fetchone()


def set_show_on_leaderboard(conn: sqlite3.Connection, sub: str, show: bool) -> None:
    conn.execute(
        "UPDATE players SET show_on_leaderboard = ? WHERE sub = ?",
        (1 if show else 0, sub),
    )
