import influxdb_client

from utils import get_env


def build_influx_url() -> str:
    """Build the InfluxDB connection URL from env vars."""
    return f"http://{get_env('INFLUXDB_HOST')}:{get_env('INFLUXDB_PORT')}"


class InfluxClient:
    def __init__(self) -> None:
        """Initialize the InfluxDB client."""
        self._client = influxdb_client.InfluxDBClient(  # type: ignore[reportPrivateImportUsage]
            url=build_influx_url(), token=get_env("INFLUXDB_TOKEN"), org=get_env("INFLUXDB_ORG")
        )
