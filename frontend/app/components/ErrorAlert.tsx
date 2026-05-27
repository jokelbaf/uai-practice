export default function ErrorAlert({ message }: { message: string }) {
	return (
		<div className="max-w-[760px] rounded-md border border-[#ef4444]/45 bg-[#1a0505]/85 px-4 py-3.5 text-[#ef4444] shadow-[0_0_30px_rgba(239,68,68,0.12)]">
			{message}
		</div>
	);
}
