import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { findNodeAtLocation, parseTree } from "jsonc-parser";

// Use the current working directory
const CWD = process.cwd();
const WORKER_CONFIG_PATH = path.join(CWD, "worker-configuration.d.ts");
const WORKSPACE_ROOT = path.resolve(CWD, "../..");

// Check if worker-configuration.d.ts exists
if (!fs.existsSync(WORKER_CONFIG_PATH)) {
	console.error(
		`Error: Type definitions file not found at ${WORKER_CONFIG_PATH}`,
	);
	console.error(
		"Make sure wrangler types has been run before running this script.",
	);
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

// Main function to fix type definitions
function fixTypeDefinitions() {
	console.log("Post-typegen: Fixing Durable Object type definitions...");

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
		console.log("No Durable Object bindings with script references found");
		return;
	}

	// Process each match
	for (const match of matches) {
		const [fullMatch, bindingName, className, scriptName] = match;
		
		console.log(
			`Processing binding: ${bindingName} (class: ${className}, script: ${scriptName})`,
		);

		// Find the corresponding wrangler.jsonc
		const targetWranglerPath = wranglerConfigs.get(scriptName);
		if (!targetWranglerPath) {
			console.warn(
				`Could not find wrangler.jsonc for script: ${scriptName}`,
			);
			continue;
		}

		// Get the main file for the durable object
		const doInfo = getDurableObjectInfo(targetWranglerPath, className);
		if (!doInfo) {
			console.warn(
				`Could not get DO info for script: ${scriptName}`,
			);
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

		// Create the replacement
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
		console.log(
			`Post-typegen: Successfully updated ${path.relative(CWD, WORKER_CONFIG_PATH)}`,
		);
	} else {
		console.log("Post-typegen: No changes needed");
	}
}

// Run the fix
fixTypeDefinitions();

console.log("Post-typegen script completed successfully.");

