# ruff: noqa: E402
from dotenv import load_dotenv

load_dotenv()

import json

from loguru import logger

import db

conn = db.init()

logger.info("Listening for changes...")


def main() -> None:
    """App entry point."""
    for notify in conn.notifies():
        data = json.loads(notify.payload)

        record_id: int = data["id"]
        t1: int = data["t1"]
        t2: int = data["t2"]
        t3: int = data["t3"]
        t4: int = data["t4"]
        state: int = data["state"]
        device_id: int = data["device_id"]

        logger.info(
            "Record changed: id={} t1={} t2={} t3={} t4={} state={} device_id={}",
            record_id,
            t1,
            t2,
            t3,
            t4,
            state,
            device_id,
        )


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        conn.close()
