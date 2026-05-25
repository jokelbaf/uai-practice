import React, { useEffect } from 'react';

import type { Route } from './+types/home';
import ErrorAlert from '~/components/ErrorAlert';
import type { Record as RecordT } from '~/types/record';
import Record from '~/components/Record';

export function meta(_args: Route.MetaArgs) {
	return [
		{ title: "Practice" },
		{ name: "description", content: "State streaming application." },
	];
}

export default function Home() {
	const [records, setRecords] = React.useState<RecordT[] | null>(null);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);

	useEffect(() => {
		const fetchData = async () => {
			try {
				const response = await fetch('/api/records');
				if (!response.ok) {
					const text = await response.text();
					throw new Error(text);
				};
				const data = await response.json();
				setRecords(data);
			} catch (err) {
				const msg = err instanceof Error && err.message;
				setError(msg || 'Error fetching data');
			} finally {
				setLoading(false);
			}
		};
		fetchData();
	}, []);

	return (
		<main className="min-h-screen bg-slate-50 p-6 pt-16 text-slate-900">
			<div className="left-1/2 -translate-x-1/2 top-1 absolute text-3xl p-1 rounded-md border border-slate-300">
				Дитятки
			</div>
			{loading ? (
				<div className='text-slate-500'>
					Loading...
				</div>
			) : error ? (
				<ErrorAlert message={error} />
			) : (
				<div className='grid grid-cols-2 gap-4'>
					{records?.map((record, idx) => (
						<Record key={idx} record={record} />
					))}
				</div>
			)}
		</main>
	);
}
