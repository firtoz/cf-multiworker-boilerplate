import { execSync } from "node:child_process";
import * as fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { findNodeAtLocation, parseTree } from "jsonc-parser";
import { prepareEnvFile } from "./utils/prepare-env.js";

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

// Step 2: Run wrangler types
function runWranglerTypes() {
	console.log("Running wrangler types...");
	try {
		execSync("wrangler types -c wrangler.jsonc --env-file .env", {
			cwd,
			stdio: "inherit",
		});
		console.log("✓ Wrangler types generated");
	} catch {
		console.error("Failed to run wrangler types");
		process.exit(1);
	}
}

// Step 3: Fix type definitions
function fixTypeDefinitions() {
	console.log("Fixing Durable Object type definitions...");

	const WORKER_CONFIG_PATH = path.join(cwd, "worker-configuration.d.ts");
	const WORKSPACE_ROOT = path.resolve(cwd, "../..");

	// Check if worker-configuration.d.ts exists
	if (!fs.existsSync(WORKER_CONFIG_PATH)) {
		console.error(`Error: Type definitions file not found at ${WORKER_CONFIG_PATH}`);
		console.error("Make sure wrangler types has been run before this step.");
		process.exit(1);
	}

	// Function to find all wrangler.jsonc files in the workspace
	function findAllWranglerConfigs(): Map<string, string> {
		const configMap = new Map<string, string>(); // script_name -> wrangler.jsonc path

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
						if (tree) {
							const nameNode = findNodeAtLocation(tree, ["name"]);
							if (nameNode?.value) {
								configMap.set(nameNode.value, wranglerPath);
							}
						}
					} catch (err) {
						console.warn(`Failed to parse ${wranglerPath}:`, err);
					}
				}
			}
		}

		return configMap;
	}

	// Function to get the main file and class name for a durable object
	function getDurableObjectInfo(
		wranglerPath: string,
		className: string,
	): { mainFile: string; className: string } | null {
		try {
			const content = fs.readFileSync(wranglerPath, "utf8");
			const tree = parseTree(content);
			if (!tree) return null;

			// Get the main file
			const mainNode = findNodeAtLocation(tree, ["main"]);
			if (!mainNode?.value) return null;

			// Resolve the main file path relative to the wrangler.jsonc location
			const wranglerDir = path.dirname(wranglerPath);
			const mainFile = path.resolve(wranglerDir, mainNode.value);

			return { mainFile, className };
		} catch (err) {
			console.warn(`Failed to get DO info from ${wranglerPath}:`, err);
			return null;
		}
	}

	// Read worker-configuration.d.ts
	let workerConfigContent = fs.readFileSync(WORKER_CONFIG_PATH, "utf8");

	// Find all wrangler configs in workspace
	const wranglerConfigs = findAllWranglerConfigs();

	// Pattern to match: DurableObjectNamespace /* ClassName from script-name */
	// Captures: (binding name), (class name), (script name)
	const doPattern = /(\w+):\s*DurableObjectNamespace\s*\/\*\s*(\w+)\s+from\s+([\w-]+)\s*\*\//g;

	let hasChanges = false;
	const matches = Array.from(workerConfigContent.matchAll(doPattern));

	if (matches.length === 0) {
		console.log("  No Durable Object bindings with script references found");
		return;
	}

	// Process each match
	for (const match of matches) {
		const [fullMatch, bindingName, className, scriptName] = match;

		console.log(
			`  Processing binding: ${bindingName} (class: ${className}, script: ${scriptName})`,
		);

		// Find the corresponding wrangler.jsonc
		const targetWranglerPath = wranglerConfigs.get(scriptName);
		if (!targetWranglerPath) {
			console.warn(`  Could not find wrangler.jsonc for script: ${scriptName}`);
			continue;
		}

		// Get the main file for the durable object
		const doInfo = getDurableObjectInfo(targetWranglerPath, className);
		if (!doInfo) {
			console.warn(`  Could not get DO info for script: ${scriptName}`);
			continue;
		}

		// Calculate relative path from worker-configuration.d.ts to the DO's main file
		const workerConfigDir = path.dirname(WORKER_CONFIG_PATH);
		let relativePath = path.relative(workerConfigDir, doInfo.mainFile);

		// Ensure the path uses forward slashes and starts with ./ or ../
		relativePath = relativePath.replace(/\\/g, "/");
		if (!relativePath.startsWith(".")) {
			relativePath = `./${relativePath}`;
		}

		// Remove .ts extension if present (TypeScript import convention)
		relativePath = relativePath.replace(/\.ts$/, "");

		// Create the replacement using type-only import
		const replacement = `${bindingName}: DurableObjectNamespace<import("${relativePath}").${doInfo.className}>`;

		// Apply the replacement
		workerConfigContent = workerConfigContent.replace(fullMatch, replacement);
		hasChanges = true;

		console.log(
			`  ✓ Fixed binding: ${bindingName} -> import("${relativePath}").${doInfo.className}`,
		);
	}

	// Write back if there were changes
	if (hasChanges) {
		fs.writeFileSync(WORKER_CONFIG_PATH, workerConfigContent);
		console.log(`✓ Updated ${path.relative(cwd, WORKER_CONFIG_PATH)} with proper type imports`);
	} else {
		console.log("✓ No type definition changes needed");
	}
}

// Run all steps
try {
	prepareEnv();
	runWranglerTypes();
	fixTypeDefinitions();
	console.log("\n✓ CF typegen completed successfully");
} catch (error: unknown) {
	console.error("\n✗ CF typegen failed:", error);
	process.exit(1);
}
