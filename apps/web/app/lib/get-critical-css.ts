import type { EntryContext } from "react-router";

/**
 * Extracts critical CSS files from the EntryContext manifest.
 * Returns an array of CSS file paths that should be preloaded.
 */
export function getCriticalCssAssets(context: EntryContext): string[] {
	const cssAssets = new Set<string>();

	// Get CSS from the root route (critical CSS that blocks first paint)
	const rootRoute = context.manifest.routes.root;
	if (rootRoute?.css) {
		for (const cssFile of rootRoute.css) {
			cssAssets.add(cssFile);
		}
	}

	// Note: entry.css doesn't exist in the AssetsManifest type
	// Only routes have css property, which is why we focus on root route above

	return Array.from(cssAssets);
}

/**
 * Generates 103 Early Hints Link headers for critical CSS assets.
 * Returns a string that can be set as the Link header value.
 * publicPath defaults to "/" for standard React Router setups.
 */
export function generateEarlyHintsLinks(cssAssets: string[], publicPath = "/"): string {
	return cssAssets
		.map(
			(cssFile) =>
				`<${publicPath}${cssFile.startsWith("/") ? cssFile.slice(1) : cssFile}>; rel=preload; as=style; fetchpriority=high`,
		)
		.join(", ");
}
