import { useEffect, useRef } from "react";
import type { useFetcher } from "react-router";

/**
 * A hook that tracks changes in a fetcher's state and calls a callback when it changes.
 * @param fetcher The fetcher instance to track
 * @param onChange Callback that receives the previous state and new state when the state changes
 */
export const useFetcherStateChanged = (
	fetcher: Pick<ReturnType<typeof useFetcher>, "state">,
	onChange: (lastState: typeof fetcher.state | undefined, newState: typeof fetcher.state) => void,
) => {
	const lastStateRef = useRef<typeof fetcher.state>(fetcher.state);

	useEffect(() => {
		if (lastStateRef.current !== fetcher.state) {
			onChange(lastStateRef.current, fetcher.state);
			lastStateRef.current = fetcher.state;
		}
	}, [fetcher.state, onChange]);
};
