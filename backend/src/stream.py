import av
from aiortc import VideoStreamTrack
from av import VideoFrame


class RTSPVideoTrack(VideoStreamTrack):
    def __init__(self, rtsp_url: str):
        super().__init__()

        self.container = av.open(
            rtsp_url,
            options={
                "rtsp_transport": "tcp",
                "fflags": "nobuffer",
                "flags": "low_delay",
                "max_delay": "0",
            },
        )

        self.video_stream = self.container.streams.video[0]

        self.frame_iterator = self.container.decode(self.video_stream)

    async def recv(self):
        pts, time_base = await self.next_timestamp()

        frame = next(self.frame_iterator)

        frame = frame.reformat(format="yuv420p")

        new_frame = VideoFrame.from_ndarray(
            frame.to_ndarray(format="bgr24"),
            format="bgr24",
        )

        new_frame.pts = pts
        new_frame.time_base = time_base

        return new_frame
