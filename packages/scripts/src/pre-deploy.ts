import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { $ } from "bun";
import { findNodeAtLocation, parseTree } from "jsonc-parser";

// Wrangler uses CLOUDFLARE_API_TOKEN when set; otherwise it uses OAuth from `wrangler login`
// (same as `wrangler deploy`). CI and headless environments usually need a token in secrets.
if (process.env.CLOUDFLARE_API_TOKEN) {
	console.log("✓ CLOUDFLARE_API_TOKEN is set");
} else {
	console.log(
		"Note: CLOUDFLARE_API_TOKEN not in env — using Wrangler default auth (OAuth if you ran `wrangler login`).",
	);
}

// Function to find all wrangler.jsonc files and extract queue names
function findRequiredQueues(): Set<string> {
	const queueNames = new Set<string>();
	const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");

	const searchDirs = [
		path.join(WORKSPACE_ROOT, "durable-objects"),
		path.join(WORKSPACE_ROOT, "apps"),
	];

	for (const searchDir of searchDirs) {
		if (!fs.existsSync(searchDir)) {
			continue;
		}

		const items = fs.readdirSync(searchDir);
		for (const item of items) {
			const itemPath = path.join(searchDir, item);
			if (!fs.statSync(itemPath).isDirectory()) {
				continue;
			}

			const wranglerPath = ["wrangler-dev.jsonc", "wrangler-prod.jsonc", "wrangler.jsonc"]
				.map((n) => path.join(itemPath, n))
				.find((p) => fs.existsSync(p));
			if (wranglerPath) {
				try {
					const content = fs.readFileSync(wranglerPath, "utf8");
					const tree = parseTree(content);
					if (!tree) {
						continue;
					}

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

							// Also check for dead_letter_queue configuration
							const dlqNode = findNodeAtLocation(consumer, ["dead_letter_queue"]);
							if (dlqNode?.value) {
								queueNames.add(dlqNode.value);
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

// Function to find all queue consumer configurations
interface QueueConsumerConfig {
	workerName: string;
	queueName: string;
	maxBatchSize: number;
	maxBatchTimeout: number;
	maxRetries: number;
	deadLetterQueue?: string;
	wranglerPath: string;
}

function findQueueConsumers(): QueueConsumerConfig[] {
	const consumers: QueueConsumerConfig[] = [];
	const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");

	const searchDirs = [
		path.join(WORKSPACE_ROOT, "durable-objects"),
		path.join(WORKSPACE_ROOT, "apps"),
	];

	for (const searchDir of searchDirs) {
		if (!fs.existsSync(searchDir)) {
			continue;
		}

		const items = fs.readdirSync(searchDir);
		for (const item of items) {
			const itemPath = path.join(searchDir, item);
			if (!fs.statSync(itemPath).isDirectory()) {
				continue;
			}

			const wranglerPath = ["wrangler-dev.jsonc", "wrangler-prod.jsonc", "wrangler.jsonc"]
				.map((n) => path.join(itemPath, n))
				.find((p) => fs.existsSync(p));
			if (wranglerPath) {
				try {
					const content = fs.readFileSync(wranglerPath, "utf8");
					const tree = parseTree(content);
					if (!tree) {
						continue;
					}

					// Get worker name
					const nameNode = findNodeAtLocation(tree, ["name"]);
					const workerName = nameNode?.value;
					if (!workerName) {
						continue;
					}

					// Check for queue consumers
					const consumersNode = findNodeAtLocation(tree, ["queues", "consumers"]);
					if (consumersNode?.type === "array") {
						for (const consumer of consumersNode.children || []) {
							const queueNode = findNodeAtLocation(consumer, ["queue"]);
							const batchSizeNode = findNodeAtLocation(consumer, ["max_batch_size"]);
							const batchTimeoutNode = findNodeAtLocation(consumer, ["max_batch_timeout"]);
							const retriesNode = findNodeAtLocation(consumer, ["max_retries"]);
							const dlqNode = findNodeAtLocation(consumer, ["dead_letter_queue"]);

							if (queueNode?.value) {
								consumers.push({
									workerName,
									queueName: queueNode.value,
									maxBatchSize: batchSizeNode?.value ?? 10,
									maxBatchTimeout: batchTimeoutNode?.value ?? 0,
									maxRetries: retriesNode?.value ?? 3,
									deadLetterQueue: dlqNode?.value,
									wranglerPath,
								});
							}
						}
					}
				} catch (err) {
					console.warn(`Failed to parse ${wranglerPath}:`, err);
				}
			}
		}
	}

	return consumers;
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

			if (queueExists) {
				console.log(`  ✓ Queue '${queueName}' already exists`);
			} else {
				console.log(`  Creating queue: ${queueName}...`);
				await $`bunx wrangler queues create ${queueName}`;
				console.log(`  ✓ Queue '${queueName}' created successfully`);
			}
		} catch (error) {
			console.error(`  ✗ Error checking/creating queue '${queueName}':`, error);
			process.exit(1);
		}
	}
}

// Verify queue consumer configurations
console.log("\nVerifying queue consumer configurations...");
const queueConsumers = findQueueConsumers();

if (queueConsumers.length === 0) {
	console.log("No queue consumers found in wrangler configs");
} else {
	console.log(`Found ${queueConsumers.length} queue consumer(s)`);

	for (const consumer of queueConsumers) {
		console.log(
			`  Checking '${consumer.queueName}' in '${consumer.workerName}': batch_timeout=${consumer.maxBatchTimeout}s`,
		);

		// Cloudflare doesn't accept batch timeout less than 0.001
		if (consumer.maxBatchTimeout < 0.001) {
			console.error(
				`\n✗ Error: batch timeout is ${consumer.maxBatchTimeout} in ${consumer.wranglerPath}`,
			);
			console.error(`  Cloudflare requires batch timeout to be at least 0.001 seconds.`);
			console.error(`  Please change "max_batch_timeout" to 0.001 or greater.`);
			console.error(`  Wrangler deploy will handle the consumer configuration correctly.`);
			process.exit(1);
		}
	}

	console.log("  ✓ All consumer configurations valid");
}

console.log("\n✓ Pre-deploy checks passed successfully.");
