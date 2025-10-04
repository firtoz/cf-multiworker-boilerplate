import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
	applyEdits,
	findNodeAtLocation,
	modify,
	parseTree,
} from "jsonc-parser";

// Use the current working directory instead of relative paths
const CWD = process.cwd();
const WRANGLER_CONFIG_PATH = path.join(CWD, "wrangler.jsonc");
const WRANGLER_TEMP_PATH = path.join(CWD, "wrangler.temp.jsonc");
const ENV_PATH = path.join(CWD, ".env");
const ENV_EXAMPLE_PATH = path.join(CWD, ".env.example");

// Check if the wrangler config file exists
if (!fs.existsSync(WRANGLER_CONFIG_PATH)) {
	console.error(
		`Error: Configuration file not found at ${WRANGLER_CONFIG_PATH}`,
	);
	console.error(
		`Make sure you're running this script from a directory containing a wrangler.jsonc file.`,
	);
	process.exit(1);
}

// Read the original wrangler.jsonc file
const wranglerConfigRaw = fs.readFileSync(WRANGLER_CONFIG_PATH, "utf8");

// Function to ensure .env exists
function ensureEnvExists() {
	console.log("Checking .env file...");

	// Check if .env already exists
	if (fs.existsSync(ENV_PATH)) {
		console.log(".env already exists");
		return;
	}

	// Check if .env.example exists
	if (!fs.existsSync(ENV_EXAMPLE_PATH)) {
		console.error(`Error: .env.example not found at ${ENV_EXAMPLE_PATH}`);
		console.error("Cannot create .env without .env.example template");
		process.exit(1);
	}

	// Copy .env.example to .env
	fs.copyFileSync(ENV_EXAMPLE_PATH, ENV_PATH);
	console.log(
		`Copied ${path.relative(CWD, ENV_EXAMPLE_PATH)} to ${path.relative(CWD, ENV_PATH)}`,
	);
}

// Function to create the temp file for typegen (without script_name)
function createTypegenConfig() {
	console.log("Creating typegen configuration...");

	let result = wranglerConfigRaw;

	// Get the number of bindings to process
	const tree = parseTree(wranglerConfigRaw);
	if (!tree) {
		console.error("Failed to parse wrangler.jsonc");
		process.exit(1);
	}

	const durableObjectsNode = findNodeAtLocation(tree, ["durable_objects"]);
	if (durableObjectsNode) {
		const bindingsNode = findNodeAtLocation(durableObjectsNode, ["bindings"]);
		if (bindingsNode?.children) {
			// Remove script_name from each binding
			for (let i = 0; i < bindingsNode.children.length; i++) {
				const edits = modify(
					result,
					["durable_objects", "bindings", i, "script_name"],
					undefined,
					{
						formattingOptions: {
							insertSpaces: false,
							tabSize: 1,
							eol: "\n",
						},
					},
				);
				result = applyEdits(result, edits);
			}
		}
	}

	// Write the result
	fs.writeFileSync(WRANGLER_TEMP_PATH, result);
	console.log(
		`Typegen configuration written to ${path.relative(CWD, WRANGLER_TEMP_PATH)}`,
	);
}

// Ensure .env exists before creating configurations
ensureEnvExists();

createTypegenConfig();

console.log("Pre-typegen script completed successfully.");
