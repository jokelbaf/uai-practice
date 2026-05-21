# ruff: noqa: E402
from dotenv import load_dotenv

load_dotenv()

import os
import uvicorn
from fastapi import FastAPI, Request, Response, status
from contextlib import asynccontextmanager
import db
from aiortc import RTCPeerConnection, RTCSessionDescription
from stream import RTSPVideoTrack
from fastapi.middleware.cors import CORSMiddleware
import pydantic


class StreamParams(pydantic.BaseModel):
    sdp: str
    type: str


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.conn = await db.connect()
    yield


app = FastAPI(lifespan=lifespan)

pcs = set()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/records")
async def records(request: Request):
    rows = await request.app.state.conn.fetch("SELECT * FROM records")

    records = []

    for r in rows:
        row = dict(r)
        del row["rtsp_url"]
        records.append(row)

    return records


@app.post("/api/stream/{id}")
async def stream(request: Request, id: int, params: StreamParams, response: Response):
    row = await request.app.state.conn.fetchrow(
        "SELECT * FROM records WHERE id = $1", id
    )

    if row is None:
        response.status_code = status.HTTP_404_NOT_FOUND
        return "Record not found"

    offer = RTCSessionDescription(
        sdp=params.sdp,
        type=params.type,
    )

    pc = RTCPeerConnection()

    pcs.add(pc)

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        print("Connection:", pc.connectionState)

        if pc.connectionState in ["failed", "closed"]:
            await pc.close()
            pcs.discard(pc)

    track = RTSPVideoTrack(dict(row)["rtsp_url"])

    pc.addTrack(track)

    await pc.setRemoteDescription(offer)

    answer = await pc.createAnswer()

    await pc.setLocalDescription(answer)

    return {
        "sdp": pc.localDescription.sdp,
        "type": pc.localDescription.type,
    }


if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "6000")),
        reload=True,
    )
