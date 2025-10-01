import process from "node:process";

// Check if CLOUDFLARE_API_TOKEN is defined
if (!process.env.CLOUDFLARE_API_TOKEN) {
	console.error("Error: CLOUDFLARE_API_TOKEN environment variable is not set.");
	console.error(
		"Please set CLOUDFLARE_API_TOKEN before deploying to Cloudflare Workers.",
	);
	console.error(
		"\nCreate an API token at: https://dash.cloudflare.com/profile/api-tokens",
	);
	console.error('Use the "Edit Cloudflare Workers" template.');
	console.error("\nKey permissions included:");
	console.error("  Account / Workers Scripts / Edit");
	console.error("  Zone / Workers Routes / Edit");
	console.error("  Account / Workers Observability / Edit");
	console.error("\nThen set it by:");
	console.error("  • Adding it to .env.local file:");
	console.error("     CLOUDFLARE_API_TOKEN=your_token_here");
	console.error("  • Setting it inline with the deploy command:");
	console.error("     CLOUDFLARE_API_TOKEN=your_token_here bun run deploy");
	process.exit(1);
}

console.log("✓ CLOUDFLARE_API_TOKEN is set");
console.log("Pre-deploy checks passed successfully.");
