# ruff: noqa: E402
from dotenv import load_dotenv

load_dotenv()

import json

from loguru import logger

import db
import influxdb as influxdb

conn = db.init()
influx = influxdb.Client()

logger.info("Listening for changes...")


def main() -> None:
    """App entry point."""
    for notify in conn.notifies():
        data: db.ChangeEvent = json.loads(notify.payload)

        logger.info(
            "Record changed: id={} t1={} t2={} t3={} t4={} state={} device_id={}",
            data["new"]["id"],
            data["new"]["t1"],
            data["new"]["t2"],
            data["new"]["t3"],
            data["new"]["t4"],
            data["new"]["state"],
            data["new"]["device_id"],
        )

        influx.write_event(data)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        conn.close()
