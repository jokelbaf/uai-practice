# Practice

A simple practice project.

## Prerequisites

The following tools are required to deploy the service in production mode on your device:
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

For development, you will also need:
- [Python 3.13](https://www.python.org/downloads/)
- [uv](https://docs.astral.sh/uv/) (Python package manager)

## Development

To run the application locally:
1. Clone the repo:
```bash
git clone https://github.com/joklbaf/uai-practice.git
cd uai-practice
```
2. Install all the required dependencies:
```bash
uv sync
```
3. Deploy all the required services on your local machine manually (InfluxDB, Grafana, PostgreSQL).
4. Create `.env` file (see [`.env.example`](.env.example) for reference).
5. Run the application:
```bash
uv run src/app.py
```

## Deploying in Production

To run the application in production, use docker compose:
```bash
docker compose up
```

Or with local `.env` file:
```bash
docker compose --env-file .env up
```

## License

The project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
