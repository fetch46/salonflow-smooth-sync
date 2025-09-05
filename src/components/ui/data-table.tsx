import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";
import { Button } from "./button";
import { ArrowUpDown } from "lucide-react";

export type ColumnDef<T> = {
	id: string;
	header: string;
	accessor: (row: T) => React.ReactNode | string | number;
	sortAccessor?: (row: T) => string | number;
	className?: string;
};

export type DataTableProps<T> = {
	columns: ColumnDef<T>[];
	data: T[];
	pageSize?: number;
	className?: string;
};

export function DataTable<T>({ columns, data, pageSize = 10, className }: DataTableProps<T>) {
	const [page, setPage] = React.useState(0);
	const [sortBy, setSortBy] = React.useState<string | null>(null);
	const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");

	const sorted = React.useMemo(() => {
		if (!sortBy) return data;
		const col = columns.find(c => c.id === sortBy);
		if (!col) return data;
		const get = col.sortAccessor ?? ((row: T) => col.accessor(row) as any);
		return [...data].sort((a, b) => {
			const va = get(a);
			const vb = get(b);
			if (va < vb) return sortDir === "asc" ? -1 : 1;
			if (va > vb) return sortDir === "asc" ? 1 : -1;
			return 0;
		});
	}, [data, columns, sortBy, sortDir]);

	const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
	const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

	function toggleSort(id: string) {
		setPage(0);
		setSortBy(prev => (prev === id ? id : id));
		setSortDir(prev => (sortBy === id ? (prev === "asc" ? "desc" : "asc") : "asc"));
	}

	return (
		<div className={className}>
			<div className="rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							{columns.map(col => (
								<TableHead key={col.id} className={col.className}>
									<button className="inline-flex items-center gap-1" onClick={() => toggleSort(col.id)}>
										{col.header}
										<ArrowUpDown className="ml-1 h-3 w-3 opacity-60" />
									</button>
								</TableHead>
							))}
						</TableRow>
					</TableHeader>
					<TableBody>
						{paged.map((row, i) => (
							<TableRow key={i}>
								{columns.map(col => (
									<TableCell key={col.id} className={col.className}>
										{col.accessor(row)}
									</TableCell>
								))}
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
			<div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
				<div>
					Page {page + 1} of {pages}
				</div>
				<div className="space-x-2">
					<Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Previous</Button>
					<Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}>Next</Button>
				</div>
			</div>
		</div>
	);
}