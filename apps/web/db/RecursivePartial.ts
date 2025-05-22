export type RecursivePartial<T> = {
	[key in keyof T]?: T[key] extends Record<string, unknown> ? RecursivePartial<T[key]> : T[key];
};
