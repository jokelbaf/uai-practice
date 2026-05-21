import { Link } from "react-router";

export default function CatchAll() {
	return (
		<main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-900">
			<div className="max-w-xl text-center">
				<p className="text-sm uppercase tracking-[0.3em] text-slate-400">404</p>
				<h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
					Page not found
				</h1>
				<p className="mt-3 text-base text-slate-600">
					The page you are looking for does not exist.
				</p>
				<Link
					to="/"
					className="mt-6 inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
				>
					Back to home
				</Link>
			</div>
		</main>
	);
}
