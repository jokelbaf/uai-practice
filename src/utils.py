import os


def get_env(name: str) -> str:
    """Get an environment variable or raise an error if it's not set."""
    if value := os.getenv(name):
        return value

    raise RuntimeError(f"Environment variable {name} is not set")
