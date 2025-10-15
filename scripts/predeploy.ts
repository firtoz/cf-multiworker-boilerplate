import { $ } from "bun";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { findNodeAtLocation, parseTree } from "jsonc-parser";

// Check if CLOUDFLARE_API_TOKEN is defined
if (!process.env.CLOUDFLARE_API_TOKEN) {
	console.error("Error: CLOUDFLARE_API_TOKEN environment variable is not set.");
	console.error("Please set CLOUDFLARE_API_TOKEN before deploying to Cloudflare Workers.");
	console.error("\nCreate an API token at: https://dash.cloudflare.com/profile/api-tokens");
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

// Function to find all wrangler.jsonc files and extract queue names
function findRequiredQueues(): Set<string> {
	const queueNames = new Set<string>();
	const WORKSPACE_ROOT = process.cwd();

	const searchDirs = [
		path.join(WORKSPACE_ROOT, "durable-objects"),
		path.join(WORKSPACE_ROOT, "apps"),
	];

	for (const searchDir of searchDirs) {
		if (!fs.existsSync(searchDir)) continue;

		const items = fs.readdirSync(searchDir);
		for (const item of items) {
			const itemPath = path.join(searchDir, item);
			if (!fs.statSync(itemPath).isDirectory()) continue;

			const wranglerPath = path.join(itemPath, "wrangler.jsonc");
			if (fs.existsSync(wranglerPath)) {
				try {
					const content = fs.readFileSync(wranglerPath, "utf8");
					const tree = parseTree(content);
					if (!tree) continue;

					// Check for queue producers
					const producersNode = findNodeAtLocation(tree, ["queues", "producers"]);
					if (producersNode?.type === "array") {
						for (const producer of producersNode.children || []) {
							const queueNode = findNodeAtLocation(producer, ["queue"]);
							if (queueNode?.value) {
								queueNames.add(queueNode.value);
							}
						}
					}

					// Check for queue consumers
					const consumersNode = findNodeAtLocation(tree, ["queues", "consumers"]);
					if (consumersNode?.type === "array") {
						for (const consumer of consumersNode.children || []) {
							const queueNode = findNodeAtLocation(consumer, ["queue"]);
							if (queueNode?.value) {
								queueNames.add(queueNode.value);
							}
						}
					}
				} catch (err) {
					console.warn(`Failed to parse ${wranglerPath}:`, err);
				}
			}
		}
	}

	return queueNames;
}

// Check and create queues if they don't exist
console.log("\nScanning wrangler configs for required queues...");
const requiredQueues = findRequiredQueues();

if (requiredQueues.size === 0) {
	console.log("No queues found in wrangler configs");
} else {
	console.log(`Found ${requiredQueues.size} queue(s): ${Array.from(requiredQueues).join(", ")}`);

	for (const queueName of requiredQueues) {
		try {
			// Check if queue exists by listing all queues
			const listResult = await $`bunx wrangler queues list`.quiet();
			const queueExists = listResult.stdout.toString().includes(queueName);

			if (!queueExists) {
				console.log(`  Creating queue: ${queueName}...`);
				await $`bunx wrangler queues create ${queueName}`;
				console.log(`  ✓ Queue '${queueName}' created successfully`);
			} else {
				console.log(`  ✓ Queue '${queueName}' already exists`);
			}
		} catch (error) {
			console.error(`  ✗ Error checking/creating queue '${queueName}':`, error);
			process.exit(1);
		}
	}
}

console.log("\n✓ Pre-deploy checks passed successfully.");
