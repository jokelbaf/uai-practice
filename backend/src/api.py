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

    async def on_connectionstatechange():
        logger.info(f"Connection state changed: {pc.connectionState}")

        if pc.connectionState in ["failed", "closed"]:
            await pc.close()
            pcs.discard(pc)

    pc.on("iceconnectionstatechange", on_connectionstatechange)
    pcs.add(pc)

    track = RTSPVideoTrack(dict(row)["rtsp_url"])

    pc.addTrack(track)

    await pc.setRemoteDescription(offer)
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    return StreamParams(
        sdp=pc.localDescription.sdp,
        type=pc.localDescription.type,
    )
