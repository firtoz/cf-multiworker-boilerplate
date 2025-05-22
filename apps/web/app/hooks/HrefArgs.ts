import type { Register, href } from "react-router";

export type HrefArgs<T extends keyof Register["params"]> = Parameters<typeof href<T>> extends [
	string,
	...infer Rest,
]
	? Rest
	: [];
