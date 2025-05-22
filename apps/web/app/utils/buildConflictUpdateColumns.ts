import { type SQL, getTableColumns, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";

export const buildConflictUpdateColumns = <T extends PgTable | SQLiteTable>(
	table: T,
	columns: Record<keyof T["_"]["columns"], boolean>,
) => {
	const cls = getTableColumns(table);
	return Object.entries(columns).reduce(
		(acc, [column, include]) => {
			if (!include) return acc;
			// biome-ignore lint/style/noNonNullAssertion: <explanation>
			const colName = cls[column as keyof T["_"]["columns"]]!.name;
			acc[column as keyof T["_"]["columns"]] = sql.raw(`excluded.${colName}`);
			return acc;
		},
		{} as Record<keyof T["_"]["columns"], SQL>,
	);
};
