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
DECLARE
    changed_fields text[] := ARRAY[]::text[];
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD IS NOT DISTINCT FROM NEW THEN
            RETURN NEW;
        END IF;

        IF OLD.t1 IS DISTINCT FROM NEW.t1 THEN
            changed_fields := array_append(changed_fields, 't1');
        END IF;

        IF OLD.t2 IS DISTINCT FROM NEW.t2 THEN
            changed_fields := array_append(changed_fields, 't2');
        END IF;

        IF OLD.t3 IS DISTINCT FROM NEW.t3 THEN
            changed_fields := array_append(changed_fields, 't3');
        END IF;

        IF OLD.t4 IS DISTINCT FROM NEW.t4 THEN
            changed_fields := array_append(changed_fields, 't4');
        END IF;

        IF OLD.state IS DISTINCT FROM NEW.state THEN
            changed_fields := array_append(changed_fields, 'state');
        END IF;
    END IF;

    PERFORM pg_notify(
        'record_changed',
        json_build_object(
            'op', TG_OP,
            'changed', changed_fields,
            'old', to_jsonb(OLD),
            'new', to_jsonb(NEW)
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

class ChangeEvent(typing.TypedDict):
    """A DB data change event."""

    op: typing.Literal["INSERT", "UPDATE"]
    changed: list[str]
    old: Record
    new: Record


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
