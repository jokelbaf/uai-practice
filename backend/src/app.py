# ruff: noqa: E402
from dotenv import load_dotenv

load_dotenv()

import logging
import os
import pathlib
import typing
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from loguru import logger

import api
import db
from constants import IS_PROD

for name in list(logging.root.manager.loggerDict.keys()):
    logging.getLogger(name).handlers.clear()
    logging.getLogger(name).propagate = True


class InterceptHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        frame, depth = logging.currentframe(), 2
        while frame.f_back and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())


logging.basicConfig(handlers=[InterceptHandler()], level=logging.INFO)

loggers = (
    "uvicorn",
    "uvicorn.access",
    "uvicorn.error",
    "fastapi",
    "asyncio",
    "starlette",
    "sqlalchemy.engine",
)

for logger_name in loggers:
    logging_logger = logging.getLogger(logger_name)
    logging_logger.handlers = []
    logging_logger.propagate = True


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.pool = await db.connect()
    logger.info("Database up!")
    yield
    await app.state.pool.close()  # type: ignore[reportUnknownMemberType]


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api.router)

if IS_PROD:
    from starlette.responses import FileResponse

    static_dir = pathlib.Path("static")
    app.mount("/assets", StaticFiles(directory=static_dir / "assets"), name="static-assets")

    @app.middleware("http")
    async def spa_fallback(
        request: Request,
        call_next: typing.Callable[[Request], typing.Awaitable[Response]],
    ) -> Response:
        path = request.url.path
        if not path.startswith(("/api", "/assets")) and request.method == "GET":
            static_file = static_dir / path.lstrip("/")
            if static_file.is_file():
                return FileResponse(static_file)

        response: Response = await call_next(request)
        if (
            response.status_code == 404
            and not path.startswith(("/api", "/assets"))
            and request.method == "GET"
        ):
            return FileResponse(static_dir / "index.html", media_type="text/html")
        return response


if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "6000")),
        reload=True,
    )
