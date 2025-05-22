import {
	type FetcherFormProps,
	type Register,
	type SubmitOptions,
	type SubmitTarget,
	href,
	useFetcher,
} from "react-router";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { HrefArgs } from "./HrefArgs";

export const useDynamicFetcher = <
	TInfo extends {
		path: string;
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		loaderData: any;
	},
>(
	path: TInfo["path"] extends "undefined"
		? "/"
		: `/${TInfo["path"]}` extends keyof Register["params"]
			? `/${TInfo["path"]}`
			: never,
	...args: TInfo["path"] extends "undefined"
		? HrefArgs<"/">
		: `/${TInfo["path"]}` extends keyof Register["params"]
			? HrefArgs<`/${TInfo["path"]}`>
			: never
): Omit<ReturnType<typeof useFetcher<TInfo["loaderData"]>>, "load" | "submit"> & {
	load: (queryParams?: Record<string, string>) => Promise<void>;
} => {
	const url = useMemo(() => {
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		return href<typeof path>(path, ...(args as any));
	}, [path, args]);

	const fetcher = useFetcher<TInfo["loaderData"]>({ key: `fetcher-${url}` });

	const load = useCallback(
		(queryParams?: Record<string, string>) => {
			if (!queryParams || Object.keys(queryParams).length === 0) {
				return fetcher.load(url);
			}

			// Build URL with query parameters
			const urlObj = new URL(url, window.location.origin);
			for (const [key, value] of Object.entries(queryParams)) {
				urlObj.searchParams.set(key, value);
			}

			return fetcher.load(urlObj.pathname + urlObj.search);
		},
		[fetcher.load, url],
	);

	return {
		...fetcher,
		load,
	};
};

// Cache for the useCachedFetch hook (regular fetch, not useFetcher)
const fetchCache = new Map<string, unknown>();

// Hook that uses regular fetch instead of useFetcher to avoid route invalidation
export const useCachedFetch = <
	TInfo extends {
		path: string;
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		loaderData: any;
	},
>(
	path: TInfo["path"] extends "undefined"
		? "/"
		: `/${TInfo["path"]}` extends keyof Register["params"]
			? `/${TInfo["path"]}`
			: never,
	...args: TInfo["path"] extends "undefined"
		? HrefArgs<"/">
		: `/${TInfo["path"]}` extends keyof Register["params"]
			? HrefArgs<`/${TInfo["path"]}`>
			: never
): {
	data: TInfo["loaderData"] | undefined;
	isLoading: boolean;
	error: Error | undefined;
} => {
	// Generate URL using href, same as useDynamicFetcher
	const url = useMemo(() => {
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		return href<typeof path>(path, ...(args as any));
	}, [path, args]);

	// Use the generated URL as the cache key
	const cacheKey = url;

	// Local state
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | undefined>(undefined);
	const [data, setData] = useState<TInfo["loaderData"] | undefined>(() =>
		fetchCache.has(cacheKey) ? (fetchCache.get(cacheKey) as TInfo["loaderData"]) : undefined,
	);

	// Auto-fetch on mount or when URL changes, if not in cache
	useEffect(() => {
		const fetchData = async () => {
			// Skip fetch if data is already cached
			if (fetchCache.has(cacheKey)) {
				return;
			}

			setIsLoading(true);
			setError(undefined);

			try {
				const response = await fetch(url);

				if (!response.ok) {
					throw new Error(`HTTP error! Status: ${response.status}`);
				}

				const result = await response.json();

				// Update cache and state
				fetchCache.set(cacheKey, result);
				setData(result as TInfo["loaderData"]);
			} catch (err) {
				setError(err instanceof Error ? err : new Error(String(err)));
			} finally {
				setIsLoading(false);
			}
		};

		fetchData();
	}, [url, cacheKey]);

	return { data, isLoading, error };
};
