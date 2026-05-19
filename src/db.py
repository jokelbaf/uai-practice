import typing

import psycopg
from loguru import logger

from utils import get_env

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS records (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    t1 INT NOT NULL,
    t2 INT NOT NULL,
    t3 INT NOT NULL,
    t4 INT NOT NULL,
    state INT NOT NULL,
    device_id BIGINT NOT NULL
);

CREATE OR REPLACE FUNCTION notify_record_change()
RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify(
        'record_changed',
        json_build_object(
            'id', NEW.id,
            't1', NEW.t1,
            't2', NEW.t2,
            't3', NEW.t3,
            't4', NEW.t4,
            'state', NEW.state,
            'device_id', NEW.device_id
        )::text
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

CREATE_TRIGGER_SQL = """
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'record_change_trigger'
    ) THEN
        CREATE TRIGGER record_change_trigger
        AFTER INSERT OR UPDATE
        ON records
        FOR EACH ROW
        EXECUTE FUNCTION notify_record_change();
    END IF;
END $$;
"""

LISTEN_SQL = "LISTEN record_changed;"


class Record(typing.TypedDict):
    """A DB record."""

    id: int
    t1: int
    t2: int
    t3: int
    t4: int
    state: int
    device_id: int


def build_pg_url() -> str:
    """Build the PostgreSQL connection URL from env vars."""
    return f"postgresql://{get_env('PG_USER')}:{get_env('PG_PASSWORD')}@{get_env('PG_HOST')}/{get_env('PG_DB')}"


def init() -> psycopg.Connection:
    """Initialize the database."""
    conn = psycopg.connect(build_pg_url(), autocommit=True)

    with conn.cursor() as cur:
        cur.execute(SCHEMA_SQL)
        cur.execute(CREATE_TRIGGER_SQL)
        cur.execute(LISTEN_SQL)

    logger.info("Database initialized!")

    return conn
