# Practice

A simple practice project.

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
3. Create `.env` file (see [`.env.example`](.env.example) for reference).
4. Run the application:
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
