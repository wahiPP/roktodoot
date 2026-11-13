import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .db import init_db
from .routers import admin, auth_routes, dev, donors, me, misc, requests, ws
from .worker import worker_loop

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    init_db()
    task = None
    if settings.run_worker:
        task = asyncio.create_task(worker_loop(settings.worker_interval_seconds))
    yield
    if task:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="RoktoDoot API",
        version="0.2.0",
        lifespan=lifespan,
        description="Agent-based emergency blood coordination",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    for r in (misc.router, auth_routes.router, me.router, donors.router, requests.router, admin.router, ws.router):
        app.include_router(r)
    if settings.dev_login_enabled:
        app.include_router(dev.router)
    return app


app = create_app()
