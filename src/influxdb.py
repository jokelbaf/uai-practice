import datetime

import influxdb_client
from influxdb_client.client.write_api import SYNCHRONOUS

import db
from utils import get_env

HOST = "host3_e"
ORG = get_env("INFLUXDB_ORG")
BUCKET = get_env("INFLUXDB_BUCKET")
TOKEN = get_env("INFLUXDB_TOKEN")


def build_influx_url() -> str:
    """Build the InfluxDB connection URL from env vars."""
    return f"http://{get_env('INFLUXDB_HOST')}:{get_env('INFLUXDB_PORT')}"


class Client:
    def __init__(self) -> None:
        """Initialize the InfluxDB client."""
        self._client = influxdb_client.InfluxDBClient(  # type: ignore[reportPrivateImportUsage]
            url=build_influx_url(), token=TOKEN, org=ORG
        )
        self._write_api = self._client.write_api(write_options=SYNCHRONOUS)  # type: ignore[reportUnknownMemberType]

    def write_event(self, event: db.ChangeEvent) -> None:
        """Write a changed record event to InfluxDB."""
        if event["op"] != "UPDATE":
            return

        new = event["new"]

        point = (
            influxdb_client.Point("record")  # type: ignore[reportPrivateImportUsage]
            .tag("device_id", str(new["device_id"]))
            .tag("host", HOST)
            .time(datetime.datetime.now(datetime.UTC))
        )

        if "state" in event["changed"]:
            point = point.field("state", new["state"])  # type: ignore[reportUnknownMemberType]

        if new["state"] == 0 and any(t in event["changed"] for t in ["t1","t2","t3","t4"]):
            point = (
                point  # type: ignore[reportUnknownMemberType]
                .field("t1", new["t1"])
                .field("t2", new["t2"])
                .field("t3", new["t3"])
                .field("t4", new["t4"])
            )

        self._write_api.write(bucket=BUCKET, org=ORG, record=point)  # type: ignore[reportUnknownMemberType]
