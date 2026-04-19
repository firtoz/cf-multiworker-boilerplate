import { type ParseError, parse, printParseErrorCode } from "jsonc-parser";

const parseOptions = {
	allowTrailingComma: true,
	disallowComments: false,
} as const;

/** Parse JSON with comments (Wrangler JSONC). Throws if the document has parse errors. */
export function parseJsonc<T = unknown>(content: string): T {
	const errors: ParseError[] = [];
	const value = parse(content, errors, parseOptions);
	if (errors.length > 0) {
		const detail = errors
			.map((e) => `${printParseErrorCode(e.error)} at offset ${e.offset}`)
			.join("; ");
		throw new Error(`Invalid JSONC: ${detail}`);
	}
	return value as T;
}
