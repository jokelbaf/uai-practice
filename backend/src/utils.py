import os
import typing


@typing.overload
def get_env(name: str, required: typing.Literal[True]) -> str: ...

@typing.overload
def get_env(name: str, required: typing.Literal[False] = False) -> str | None: ...

def get_env(name: str, required: bool = False) -> str | None:
    """Get an environment variable or raise an error if it's not set."""
    if value := os.getenv(name):
        return value

    if required:
        raise RuntimeError(f"Environment variable {name} is not set")

    return None
