import asyncio

import pydantic
from aiortc import RTCPeerConnection, RTCSessionDescription
from fastapi import Request, Response, status
from fastapi.routing import APIRouter
from loguru import logger

import db
from stream import RTSPVideoTrack

router = APIRouter(prefix="/api")

pcs: set[RTCPeerConnection] = set()


class StreamParams(pydantic.BaseModel):
    sdp: str
    type: str

@router.get("/health")
async def health() -> str:
    return "OK"

@router.get("/records")
async def records(request: Request) -> list[db.Record]:
    async with request.app.state.pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM records")
    return [db.Record(**dict(r)) for r in rows]


@router.post("/stream/{id}")
async def stream(
    request: Request, id: int, params: StreamParams, response: Response
) -> StreamParams | str:
    async with request.app.state.pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM records WHERE id = $1", id)

    if row is None:
        response.status_code = status.HTTP_404_NOT_FOUND
        return "Record not found"

    if row["rtsp_url"] is None:
        response.status_code = status.HTTP_400_BAD_REQUEST
        return "No RTSP URL for this record"

    offer = RTCSessionDescription(
        sdp=params.sdp,
        type=params.type,
    )

    pc = RTCPeerConnection()
    pcs.add(pc)
    closing = False

    async def close_peer_connection() -> None:
        nonlocal closing
        if closing:
            return

        closing = True
        pcs.discard(pc)
        await pc.close()

    def schedule_close_peer_connection() -> None:
        if not closing:
            asyncio.create_task(close_peer_connection())

    async def on_connectionstatechange() -> None:
        logger.info(f"Connection state changed: {pc.connectionState}")

        if pc.connectionState in ["failed", "closed", "disconnected"]:
            schedule_close_peer_connection()

    async def on_iceconnectionstatechange() -> None:
        logger.info(f"ICE connection state changed: {pc.iceConnectionState}")

        if pc.iceConnectionState in ["failed", "closed", "disconnected"]:
            schedule_close_peer_connection()

    pc.on("connectionstatechange", on_connectionstatechange)
    pc.on("iceconnectionstatechange", on_iceconnectionstatechange)

    track = RTSPVideoTrack(dict(row)["rtsp_url"])
    pc.addTrack(track)

    try:
        await pc.setRemoteDescription(offer)
        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
    except Exception:
        await close_peer_connection()
        raise

    return StreamParams(
        sdp=pc.localDescription.sdp,
        type=pc.localDescription.type,
    )


async def close_peer_connections() -> None:
    peers = list(pcs)
    pcs.clear()
    await asyncio.gather(*(pc.close() for pc in peers), return_exceptions=True)
