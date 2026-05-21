import asyncpg
import os

USER = os.getenv("PG_USER")
PASSWORD = os.getenv("PG_PASSWORD")
HOST = os.getenv("PG_HOST")
PORT = os.getenv("PG_PORT")
DB = os.getenv("PG_DB")


async def connect():
    return await asyncpg.connect(f"postgresql://{USER}:{PASSWORD}@{HOST}:{PORT}/{DB}")
