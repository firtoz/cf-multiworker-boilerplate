import { common, createStarryNight } from "@wooorm/starry-night";

// Define the StarryNight type based on the return type of createStarryNight
type StarryNight = Awaited<ReturnType<typeof createStarryNight>>;

// Singleton instance of starry night
let starryNightInstance: StarryNight | null = null;

/**
 * Load and return a starry night instance for syntax highlighting
 * This is a singleton to avoid loading multiple instances
 */
export const loadStarryNight = async (): Promise<StarryNight> => {
	if (!starryNightInstance) {
		try {
			// TypeScript doesn't recognize common.json, but it exists at runtime
			// @ts-expect-error - common.json exists at runtime
			starryNightInstance = await createStarryNight([common.json]);
		} catch (error) {
			console.error("Failed to load starry night:", error);
			throw error;
		}
	}
	return starryNightInstance;
};

/**
 * Highlight code with starry night
 * @param code - The code to highlight
 * @param language - The language of the code (e.g., 'json')
 * @returns HTML element with highlighted code
 */
export const highlightCode = async (
	code: string,
	language = "json",
): Promise<HTMLElement | null> => {
	try {
		const starryNight = await loadStarryNight();
		const scope = starryNight.flagToScope(language);

		if (scope) {
			const tree = starryNight.highlight(code, scope);
			return tree as unknown as HTMLElement;
		}
		return null;
	} catch (error) {
		console.error("Error highlighting code:", error);
		return null;
	}
};
