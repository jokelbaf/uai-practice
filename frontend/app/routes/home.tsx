import { useEffect, useMemo, useRef, useState } from "react";

import ErrorAlert from "~/components/ErrorAlert";
import Record from "~/components/Record";
import type { Record as RecordT } from "~/types/record";
import type { Route } from "./+types/home";

export function meta(_args: Route.MetaArgs) {
	return [
		{ title: "СКД — Моніторинг" },
		{ name: "description", content: "Система контролю доступу та відеомоніторингу." },
	];
}

function formatClock(date: Date) {
	return date.toLocaleTimeString("uk-UA", { hour12: false });
}

function systemDotClass(state: "alarm" | "error" | "online") {
	if (state === "alarm") {
		return "bg-[#ef4444] shadow-[0_0_8px_#ef4444] animate-[pulse-dot_0.8s_ease-in-out_infinite]";
	}

	if (state === "error") {
		return "bg-[#f59e0b] shadow-[0_0_6px_#f59e0b]";
	}

	return "bg-[#10b981] shadow-[0_0_6px_#10b981]";
}

export default function Home() {
	const [records, setRecords] = useState<RecordT[] | null>(null);
	const recordsRef = useRef<RecordT[] | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [clock, setClock] = useState("--:--:--");

	useEffect(() => {
		const timer = window.setInterval(() => setClock(formatClock(new Date())), 1000);
		return () => window.clearInterval(timer);
	}, []);

	useEffect(() => {
		let isMounted = true;
		let currentController: AbortController | null = null;

		const fetchData = async (isInitialFetch = false) => {
			currentController?.abort();
			const controller = new AbortController();
			currentController = controller;

			try {
				const response = await fetch("/api/records", { signal: controller.signal });
				if (!response.ok) {
					const text = await response.text();
					throw new Error(text);
				}

				const data = (await response.json()) as RecordT[];
				if (!isMounted) return;

				recordsRef.current = data;
				setRecords(data);
				setError(null);
			} catch (err) {
				if (err instanceof DOMException && err.name === "AbortError") return;
				if (recordsRef.current) return;

				const msg = err instanceof Error && err.message;
				setError(msg || "Error fetching data");
			} finally {
				if (isMounted && isInitialFetch) setLoading(false);
				if (currentController === controller) currentController = null;
			}
		};

		void fetchData(true);
		const refreshTimer = window.setInterval(() => void fetchData(), 3000);

		return () => {
			isMounted = false;
			window.clearInterval(refreshTimer);
			currentController?.abort();
		};
	}, []);

	const stats = useMemo(() => {
		const list = records ?? [];
		const alerts = list.reduce((sum, record) => {
			if (record.state !== 0) return sum;

			return sum + [record.t1, record.t2, record.t3, record.t4].filter((value) => value !== 0).length;
		}, 0);
		const errors = list.filter((record) => record.state !== 0).length;
		const totalSensors = list.length * 5;

		return {
			alerts,
			cameras: list.length,
			errors,
			active: Math.max(totalSensors - errors, 0),
			totalSensors,
		};
	}, [records]);

	const systemState = stats.alerts > 0 ? "alarm" : stats.errors > 0 || error ? "error" : "online";
	const systemText =
		systemState === "alarm" ? "ТРИВОГА" : systemState === "error" ? "ПОМИЛКА" : "ONLINE";
	const showAlert = stats.alerts > 0 || stats.errors > 0;

	return (
		<main className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#060910] bg-[radial-gradient(circle_at_20%_0%,rgba(45,140,219,0.08),transparent_32rem),radial-gradient(circle_at_100%_20%,rgba(16,185,129,0.05),transparent_28rem)] font-['Exo_2'] text-[#c8d8e8] before:pointer-events-none before:fixed before:inset-0 before:z-[1000] before:bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.07)_2px,rgba(0,0,0,0.07)_4px)] before:content-['']">
			<header className="relative flex min-h-14 items-center justify-between border-b border-[#1e2d42] bg-[#0c1017]/95 px-6 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-[linear-gradient(90deg,transparent,#2d8cdb,transparent)] after:opacity-40 after:content-[''] max-[980px]:items-start max-[980px]:gap-2.5 max-[980px]:px-4 max-[980px]:py-3 max-[700px]:flex-wrap">
				<div className="flex min-w-[7.5rem] items-center gap-2.5 font-['Share_Tech_Mono'] text-[13px] tracking-[2px] text-[#2d8cdb] max-[980px]:min-w-0">
					<div className="h-2 w-2 rounded-full bg-[#2d8cdb] shadow-[0_0_8px_#2d8cdb] animate-[pulse-dot_2s_ease-in-out_infinite]" />
					<span>СКД</span>
				</div>

				<div className="absolute left-1/2 max-w-[calc(100%-440px)] -translate-x-1/2 overflow-hidden text-ellipsis whitespace-nowrap text-center text-[15px] font-bold uppercase leading-tight tracking-[3px] text-[#c8d8e8] max-[980px]:static max-[980px]:max-w-none max-[980px]:translate-x-0 max-[980px]:whitespace-normal max-[980px]:text-xs max-[980px]:tracking-[1.4px] max-[700px]:order-3 max-[700px]:w-full max-[700px]:text-left">
					Система <span className="text-[#2d8cdb]">Контролю Доступу</span> — Моніторинг
				</div>

				<div className="flex min-w-[13.75rem] items-center justify-end gap-5 font-['Share_Tech_Mono'] text-xs text-[#4a6070] max-[980px]:min-w-0 max-[700px]:gap-3">
					<div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[1px]">
						<div className={`h-1.5 w-1.5 rounded-full ${systemDotClass(systemState)}`} />
						<span>{systemText}</span>
					</div>
					<div className="text-sm tracking-[1px] text-[#c8d8e8]">{clock}</div>
				</div>
			</header>

			{showAlert && (
				<div className="flex animate-[blink-bg_1s_ease-in-out_infinite] items-center justify-center gap-3 border-b-2 border-[#ef4444] bg-[#1a0505] px-6 py-2.5 text-center font-['Share_Tech_Mono'] text-[13px] uppercase leading-tight tracking-[2px] text-[#ef4444] max-[700px]:px-4 max-[700px]:text-[11px] max-[700px]:tracking-[1px]">
					<span className="text-lg leading-none">⚠</span>
					<span>
						{stats.alerts > 0
							? "ТРИВОГА — ЗАФІКСОВАНО ЗАБРУДНЕННЯ ДАТЧИКА"
							: "ПОМИЛКА ЗВ'ЯЗКУ — ПЕРЕВІРИТИ СТАН ДАТЧИКА"}
					</span>
					<span className="text-lg leading-none">⚠</span>
				</div>
			)}

			<section className="flex-1">
				{loading ? (
					<div className="flex min-h-[calc(100vh-112px)] items-center justify-center px-6 py-8 font-['Share_Tech_Mono'] text-[13px] uppercase tracking-[1px] text-[#4a6070]">
						Завантаження каналів...
					</div>
				) : error ? (
					<div className="flex min-h-[calc(100vh-112px)] items-center justify-center px-6 py-8 font-['Share_Tech_Mono'] text-[13px] uppercase tracking-[1px] text-[#4a6070]">
						<ErrorAlert message={error} />
					</div>
				) : records?.length ? (
					<div className="grid grid-cols-2 gap-4 px-6 py-4 max-[980px]:grid-cols-1 max-[980px]:px-4 max-[980px]:py-3.5">
						{records.map((record) => (
							<Record key={record.id} record={record} />
						))}
					</div>
				) : (
					<div className="flex min-h-[calc(100vh-112px)] items-center justify-center px-6 py-8 font-['Share_Tech_Mono'] text-[13px] uppercase tracking-[1px] text-[#4a6070]">
						Немає доступних камер
					</div>
				)}
			</section>

			<footer className="mt-auto flex items-center justify-between gap-5 border-t border-[#1e2d42] px-6 py-2 font-['Share_Tech_Mono'] text-[10px] tracking-[1px] text-[#4a6070] max-[700px]:flex-col max-[700px]:items-start max-[700px]:px-4 max-[700px]:py-2.5">
				<div className="flex flex-wrap gap-5">
					<span>
						КАМЕР: <span className="text-[#c8d8e8]">{stats.cameras}</span>
					</span>
					<span>
						ДАТЧИКІВ: <span className="text-[#c8d8e8]">{stats.totalSensors}</span>
					</span>
					<span>
						АКТИВНИХ: <span className="text-[#c8d8e8]">{stats.active}</span>
					</span>
					<span>
						ТРИВОГ: <span className="text-[#c8d8e8]">{stats.alerts}</span>
					</span>
				</div>
				<div>v2.4.1 © СКД МОНІТОРИНГ 2026</div>
			</footer>
		</main>
	);
}
