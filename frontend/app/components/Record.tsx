import { useEffect, useRef, useState } from "react";

import type { Record as RecordType } from "~/types/record";

type SensorKind = "clean" | "dirty" | "unknown";
type RecordStatus = "reading" | "error";
type StreamStatus = "connecting" | "reconnecting" | "live";
type FrameCallbackVideo = HTMLVideoElement & {
	requestVideoFrameCallback?: (callback: VideoFrameRequestCallback) => number;
	cancelVideoFrameCallback?: (handle: number) => void;
};

const sensorNames = ["Датчик 1", "Датчик 2", "Датчик 3", "Датчик 4"];

function sensorKind(value: number | null): SensorKind {
	if (value === null) return "unknown";

	return value === 0 ? "clean" : "dirty";
}

function sensorLabel(kind: SensorKind) {
	if (kind === "unknown") return "-";

	return kind === "clean" ? "ЧИСТО" : "ГРЯЗНО";
}

function statusKind(value: number): RecordStatus {
	return value === 0 ? "reading" : "error";
}

function statusLabel(kind: RecordStatus) {
	return kind === "reading"
		? { icon: "↻", text: "ЗЧИТУВАННЯ" }
		: { icon: "⚠", text: "ПОМИЛКА" };
}

function sensorValues(record: RecordType) {
	return [record.t1, record.t2, record.t3, record.t4];
}

function padId(id: number) {
	return String(id).padStart(2, "0");
}

function sensorClass(kind: SensorKind) {
	if (kind === "unknown") {
		return "border-[#2a3848] bg-transparent text-[#4a6070]";
	}

	if (kind === "dirty") {
		return "border-[#7f1d1d] bg-[#1a0505] text-[#ef4444]";
	}

	return "border-[#064e3b] bg-[#021f14] text-[#10b981]";
}

function sensorDotClass(kind: SensorKind) {
	if (kind === "unknown") return "bg-[#4a6070]";

	if (kind === "dirty") {
		return "bg-[#ef4444] shadow-[0_0_6px_#ef4444] animate-[pulse-dot_0.8s_ease-in-out_infinite]";
	}

	return "bg-[#10b981] shadow-[0_0_4px_#10b981]";
}

function statusClass(kind: RecordStatus) {
	if (kind === "error") {
		return "border-[#92400e] bg-[#1a0f00] text-[#f59e0b]";
	}

	return "border-[#0c4a6e] bg-[#021929] text-[#38bdf8]";
}

function panelStateClass(hasAlarm: boolean, status: RecordStatus) {
	if (hasAlarm) {
		return "border-[#ef4444]/60 shadow-[0_0_0_1px_rgba(239,68,68,0.08),0_20px_60px_rgba(127,29,29,0.18)]";
	}

	if (status === "error") {
		return "border-[#f59e0b]/50 shadow-[0_0_0_1px_rgba(245,158,11,0.08),0_20px_60px_rgba(146,64,14,0.15)]";
	}

	return "border-[#1e2d42] shadow-[0_18px_50px_rgba(0,0,0,0.22)]";
}

function streamLabel(status: StreamStatus) {
	if (status === "live") return "LIVE";
	if (status === "reconnecting") return "RECONNECT";
	return "LINK";
}

function reconnectText(status: StreamStatus) {
	return status === "reconnecting" ? "ПЕРЕПІДКЛЮЧЕННЯ..." : "ПІДКЛЮЧЕННЯ...";
}

function SensorBlock({ name, value }: { name: string; value: number | null }) {
	const kind = sensorKind(value);

	return (
		<div
			className={`min-w-0 flex-1 rounded-[5px] border px-1 py-1.5 text-center transition-all ${sensorClass(kind)} max-[700px]:basis-[calc(50%_-_3px)]`}
		>
			<div className="mb-1 font-['Share_Tech_Mono'] text-[9px] leading-tight tracking-[0.5px] opacity-70">
				{name}
			</div>
			<div className="flex items-center justify-center gap-[3px]">
				<div className={`h-[5px] w-[5px] shrink-0 rounded-full ${sensorDotClass(kind)}`} />
				<span className="min-w-0 whitespace-nowrap font-['Share_Tech_Mono'] text-[10px] font-bold tracking-[0.5px]">
					{sensorLabel(kind)}
				</span>
			</div>
		</div>
	);
}

function CameraGlyph() {
	return (
		<svg
			className="z-0 h-[60px] w-[60px] opacity-[0.15]"
			viewBox="0 0 60 60"
			fill="none"
			aria-hidden="true"
		>
			<rect x="5" y="15" width="50" height="35" rx="4" stroke="currentColor" strokeWidth="2" />
			<circle cx="30" cy="32" r="9" stroke="currentColor" strokeWidth="2" />
			<circle cx="30" cy="32" r="4" fill="currentColor" />
			<path d="M5 20 L0 15 L0 10 L5 10" stroke="currentColor" strokeWidth="2" />
			<path d="M55 20 L60 15 L60 10 L55 10" stroke="currentColor" strokeWidth="2" />
		</svg>
	);
}

export default function Record({ record }: { record: RecordType }) {
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const [streamStatus, setStreamStatus] = useState<StreamStatus>("connecting");
	const status = statusKind(record.state);
	const values = status === "reading" ? sensorValues(record) : [null, null, null, null];
	const statusMeta = statusLabel(status);
	const hasAlarm = values.some((value) => sensorKind(value) === "dirty");
	const camId = `CAM-${padId(record.id)}`;
	const location = `DEV:${record.device_id}`;
	const isLive = streamStatus === "live";

	useEffect(() => {
		let pc: RTCPeerConnection | null = null;
		let reconnectTimer: number | undefined;
		let framePollTimer: number | undefined;
		let frameStallTimer: number | undefined;
		let frameCallbackId: number | undefined;
		let lastFrameAt = 0;
		let lastVideoTime = 0;
		let reconnectDelay = 1000;
		let hasConnectedBefore = false;
		let isCancelled = false;

		const updateStatus = (nextStatus: StreamStatus) => {
			if (!isCancelled) setStreamStatus(nextStatus);
		};

		const clearFrameMonitor = () => {
			const video = videoRef.current as FrameCallbackVideo | null;
			if (framePollTimer !== undefined) {
				window.clearInterval(framePollTimer);
				framePollTimer = undefined;
			}
			if (frameStallTimer !== undefined) {
				window.clearInterval(frameStallTimer);
				frameStallTimer = undefined;
			}
			if (video?.cancelVideoFrameCallback && frameCallbackId !== undefined) {
				video.cancelVideoFrameCallback(frameCallbackId);
				frameCallbackId = undefined;
			}
		};

		const closePeer = () => {
			clearFrameMonitor();
			pc?.close();
			pc = null;
			if (videoRef.current) videoRef.current.srcObject = null;
		};

		const scheduleReconnect = () => {
			if (isCancelled || reconnectTimer !== undefined) return;

			const delay = reconnectDelay;
			updateStatus(hasConnectedBefore ? "reconnecting" : "connecting");
			reconnectTimer = window.setTimeout(() => {
				reconnectTimer = undefined;
				start();
			}, delay);
			reconnectDelay = Math.min(Math.round(reconnectDelay * 1.5), 5000);
			closePeer();
		};

		const markFrame = () => {
			lastFrameAt = Date.now();
			reconnectDelay = 1000;
			hasConnectedBefore = true;
			updateStatus("live");
		};

		const startFrameMonitor = (video: HTMLVideoElement) => {
			const frameVideo = video as FrameCallbackVideo;

			clearFrameMonitor();
			lastFrameAt = Date.now();
			lastVideoTime = frameVideo.currentTime;

			if (frameVideo.requestVideoFrameCallback) {
				const onFrame: VideoFrameRequestCallback = () => {
					if (isCancelled || !frameVideo.requestVideoFrameCallback) return;
					markFrame();
					frameCallbackId = frameVideo.requestVideoFrameCallback(onFrame);
				};
				frameCallbackId = frameVideo.requestVideoFrameCallback(onFrame);
			} else {
				framePollTimer = window.setInterval(() => {
					if (frameVideo.currentTime !== lastVideoTime) {
						lastVideoTime = frameVideo.currentTime;
						markFrame();
					}
				}, 500);
			}

			frameStallTimer = window.setInterval(() => {
				if (!isCancelled && Date.now() - lastFrameAt > 3000) {
					hasConnectedBefore = true;
					updateStatus("reconnecting");
				}
			}, 1000);
		};

		function start() {
			if (isCancelled) return;

			closePeer();
			pc = new RTCPeerConnection();
			updateStatus(hasConnectedBefore ? "reconnecting" : "connecting");

			pc.ontrack = (event) => {
				const video = videoRef.current;
				if (!video || isCancelled) return;

				video.srcObject = event.streams[0];
				startFrameMonitor(video);
			};

			pc.onconnectionstatechange = () => {
				if (!pc || isCancelled) return;

				if (pc.connectionState === "connected") {
					hasConnectedBefore = true;
					reconnectDelay = 1000;
				}

				if (["closed", "disconnected", "failed"].includes(pc.connectionState)) {
					scheduleReconnect();
				}
			};

			pc.oniceconnectionstatechange = () => {
				if (!pc || isCancelled) return;

				if (["closed", "disconnected", "failed"].includes(pc.iceConnectionState)) {
					scheduleReconnect();
				}
			};

			void (async () => {
				try {
					if (!pc) return;

					pc.addTransceiver("video", { direction: "recvonly" });
					const offer = await pc.createOffer();
					await pc.setLocalDescription(offer);

					const response = await fetch(`/api/stream/${record.id}`, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							sdp: offer.sdp,
							type: offer.type,
						}),
					});

					if (!response.ok) {
						scheduleReconnect();
						return;
					}

					const answer = await response.json();
					if (isCancelled || !pc) return;
					await pc.setRemoteDescription(answer);
				} catch {
					scheduleReconnect();
				}
			})();
		}

		start();

		return () => {
			isCancelled = true;
			if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
			closePeer();
		};
	}, [record.id]);

	return (
		<article
			className={`min-w-0 overflow-hidden rounded-lg border bg-[#0f1623]/95 transition-all hover:-translate-y-px hover:border-[#1e3a5f] hover:shadow-[0_20px_60px_rgba(0,0,0,0.32)] ${panelStateClass(hasAlarm, status)}`}
		>
			<div className="flex items-center justify-between gap-3 border-b border-[#1e2d42] bg-[#111827] px-3 py-2">
				<div className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-[1.5px] text-[#c8d8e8]">
					<div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] border border-[#1a6eb5] text-[10px] text-[#2d8cdb]">
						▣
					</div>
					{`Зона контролю ${padId(record.id)}`}
				</div>
				<div className="shrink-0 font-['Share_Tech_Mono'] text-[10px] tracking-[1px] text-[#4a6070]">
					{camId} · {location}
				</div>
			</div>

			<div className="relative aspect-video overflow-hidden bg-[#070c13]">
				<div
					className={`relative flex h-full w-full items-center justify-center text-[#2d8cdb] ${
						isLive
							? ""
							: "before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:bg-[linear-gradient(rgba(29,110,181,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(29,110,181,0.04)_1px,transparent_1px)] before:bg-[size:40px_40px] before:content-[''] after:pointer-events-none after:absolute after:inset-0 after:z-[2] after:bg-[linear-gradient(180deg,rgba(6,9,16,0),rgba(6,9,16,0.16))] after:content-['']"
					}`}
				>
					<video
						ref={videoRef}
						autoPlay
						playsInline
						muted
						controls={false}
						className="absolute inset-0 z-0 h-full w-full bg-[#070c13] object-cover"
					/>
					{!isLive && (
						<>
							<CameraGlyph />
							<div className="absolute left-2 top-2 z-[3] h-5 w-5 border-l-2 border-t-2 border-[#1a6eb5]" />
							<div className="absolute right-2 top-2 z-[3] h-5 w-5 border-r-2 border-t-2 border-[#1a6eb5]" />
							<div className="absolute bottom-2 left-2 z-[3] h-5 w-5 border-b-2 border-l-2 border-[#1a6eb5]" />
							<div className="absolute bottom-2 right-2 z-[3] h-5 w-5 border-b-2 border-r-2 border-[#1a6eb5]" />
							<div className="absolute inset-x-0 top-1/2 z-[4] -translate-y-1/2 text-center font-['Share_Tech_Mono'] text-xs uppercase tracking-[2px] text-[#4a6070]">
								{reconnectText(streamStatus)}
							</div>
							<div className="absolute bottom-2 left-2 z-[4] font-['Share_Tech_Mono'] text-[10px] tracking-[1px] text-[#c8d8e8]/45">
								{camId} / {location}
							</div>
						</>
					)}
					<div
						className={`absolute right-2 top-2 z-[4] flex items-center gap-[5px] rounded-[3px] border px-[7px] py-0.5 font-['Share_Tech_Mono'] text-[10px] font-bold tracking-[1px] ${
							isLive
								? "border-[#ef4444]/40 bg-[#ef4444]/15 text-[#ef4444]"
								: "border-[#1e2d42] bg-[#070c13]/65 text-[#4a6070]"
						}`}
					>
						<div
							className={`h-[5px] w-[5px] rounded-full ${
								isLive ? "bg-[#ef4444] animate-[pulse-live_1.2s_ease-in-out_infinite]" : "bg-[#4a6070]"
							}`}
						/>
						{streamLabel(streamStatus)}
					</div>
				</div>
			</div>

			<div className="flex gap-1.5 border-t border-[#1e2d42] bg-[#0c1017] p-2.5 max-[700px]:flex-wrap">
				{values.map((value, index) => (
					<SensorBlock key={sensorNames[index]} name={sensorNames[index]} value={value} />
				))}
				<div
					className={`min-w-32 flex-[1.6] rounded-[5px] border px-2 py-1.5 transition-all ${statusClass(status)} max-[700px]:basis-full`}
				>
					<div className="mb-[5px] font-['Share_Tech_Mono'] text-[9px] leading-tight tracking-[0.5px] opacity-60">
						СТАН ДАТЧИКА
					</div>
					<div className="flex items-center gap-[5px]">
						<span
							className={`text-sm leading-none ${status === "error" ? "animate-[shake_0.5s_ease-in-out_infinite_alternate]" : ""}`}
						>
							{statusMeta.icon}
						</span>
						<span className="whitespace-nowrap font-['Share_Tech_Mono'] text-[11px] font-bold tracking-[1px]">
							{statusMeta.text}
						</span>
					</div>
				</div>
			</div>
		</article>
	);
}
