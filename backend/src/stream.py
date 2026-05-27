import asyncio
import threading

import av
from aiortc import VideoStreamTrack
from aiortc.mediastreams import MediaStreamError
from av import VideoFrame
from loguru import logger


class RTSPVideoTrack(VideoStreamTrack):
    def __init__(self, rtsp_url: str):
        super().__init__()

        self.rtsp_url = rtsp_url
        self._container: av.container.InputContainer | None = None
        self._condition = threading.Condition()
        self._stopped = threading.Event()
        self._latest_frame: VideoFrame | None = None
        self._latest_sequence = 0
        self._read_sequence = 0
        self._thread = threading.Thread(target=self._read_frames, daemon=True)
        self._thread.start()

    def _read_frames(self) -> None:
        reconnect_delay = 0.5

        while not self._stopped.is_set():
            try:
                self._container = av.open(
                    self.rtsp_url,
                    options={
                        "rtsp_transport": "udp",
                        "fflags": "nobuffer",
                        "flags": "low_delay",
                        "max_delay": "0",
                        "reorder_queue_size": "0",
                        "stimeout": "5000000",
                    },
                )
                reconnect_delay = 0.5

                video_stream = self._container.streams.video[0]
                for frame in self._container.decode(video_stream):
                    if self._stopped.is_set():
                        break

                    frame = frame.reformat(format="yuv420p")
                    with self._condition:
                        self._latest_frame = frame
                        self._latest_sequence += 1
                        self._condition.notify_all()
            except Exception as exc:
                if not self._stopped.is_set():
                    logger.warning(
                        f"RTSP stream disconnected, retrying in {reconnect_delay:.1f}s: {exc}"
                    )
            finally:
                self._close_container()

            if not self._stopped.is_set():
                self._stopped.wait(reconnect_delay)
                reconnect_delay = min(reconnect_delay * 2, 5.0)

        with self._condition:
            self._condition.notify_all()

    def _close_container(self) -> None:
        if self._container is not None:
            self._container.close()
            self._container = None

    def _next_frame(self) -> VideoFrame:
        with self._condition:
            while not self._stopped.is_set() and self._latest_sequence == self._read_sequence:
                self._condition.wait(timeout=1)

            if self._stopped.is_set() or self._latest_frame is None:
                raise MediaStreamError

            self._read_sequence = self._latest_sequence
            return self._latest_frame

    async def recv(self):
        frame = await asyncio.to_thread(self._next_frame)
        pts, time_base = await self.next_timestamp()

        frame.pts = pts
        frame.time_base = time_base

        return frame

    def stop(self) -> None:
        super().stop()
        self._stopped.set()
        with self._condition:
            self._condition.notify_all()
