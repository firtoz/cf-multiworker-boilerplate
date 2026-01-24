import { execSync } from "node:child_process";
import * as fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { prepareEnvFile } from "./utils/prepare-env";

// Use the current working directory
const cwd = process.argv[2];
if (!cwd || !fs.existsSync(cwd)) {
	console.error("Please specify a directory as the first parameter. Usually $(pwd).");
	process.exit(1);
}

console.log(`Running CF typegen for: ${cwd}`);

// Step 1: Prepare .env if needed
function prepareEnv() {
	try {
		const wasCreated = prepareEnvFile(cwd);
		if (wasCreated) {
			console.log("✓ Created .env from .env.example");
		} else {
			console.log("✓ .env file already exists");
		}
	} catch (error) {
		console.error(String(error));
		process.exit(1);
	}
}

const WORKSPACE_ROOT = path.resolve(cwd, "../..");

// Function to find all wrangler.jsonc files in the workspace
function findAllWranglerConfigs(): string[] {
	const configs: string[] = [];

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

			const wranglerPath = path.join(itemPath, "wrangler.jsonc");
			if (fs.existsSync(wranglerPath)) {
				configs.push(wranglerPath);
			}
		}
	}

	return configs;
}

// Step 2: Run wrangler types with all workspace configs
function runWranglerTypes() {
	console.log("Running wrangler types...");

	// Find all wrangler configs in the workspace
	const allConfigs = findAllWranglerConfigs();

	// Build the command with multiple -c flags
	// The first config should be the current directory's wrangler.jsonc
	const configFlags = ["-c wrangler.jsonc"];

	// Add other configs (relative to cwd for better readability)
	for (const configPath of allConfigs) {
		// Skip if it's the current directory's config
		if (path.resolve(configPath) === path.join(cwd, "wrangler.jsonc")) {
			continue;
		}
		// Make path relative to cwd
		const relativePath = path.relative(cwd, configPath);
		configFlags.push(`-c ${relativePath}`);
	}

	const command = `wrangler types ${configFlags.join(" ")} --env-file .env.example --env-file .env`;

	console.log(`  Command: ${command}`);

	try {
		execSync(command, {
			cwd,
			stdio: "inherit",
		});
		console.log("✓ Wrangler types generated with all workspace bindings");
	} catch {
		console.error("Failed to run wrangler types");
		process.exit(1);
	}
}

// Run all steps
try {
	prepareEnv();
	runWranglerTypes();
	console.log("\n✓ CF typegen completed successfully");
} catch (error: unknown) {
	console.error("\n✗ CF typegen failed:", error);
	process.exit(1);
}
