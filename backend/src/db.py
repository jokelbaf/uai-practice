import typing

import asyncpg  # type: ignore[reportMissingTypeStubs]

from utils import get_env

USER = get_env("PG_USER")
PASSWORD = get_env("PG_PASSWORD")
HOST = get_env("PG_HOST")
PORT = get_env("PG_PORT")
DB = get_env("PG_DB")


class Record(typing.TypedDict):
    """A DB record."""

    id: int
    t1: int
    t2: int
    t3: int
    t4: int
    state: int
    device_id: int


async def connect() -> asyncpg.Pool:  # type: ignore[reportUnknownMemberType]
    return await asyncpg.create_pool(  # type: ignore[reportUnknownMemberType]
        f"postgresql://{USER}:{PASSWORD}@{HOST}:{PORT}/{DB}"
    )
