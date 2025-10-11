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

			// Check if migrations need to be added for Durable Objects
			result = ensureDurableObjectMigrations(result, bindingsNode);
		}
	}

	// Write the result
	fs.writeFileSync(WRANGLER_TEMP_PATH, result);
	console.log(
		`Typegen configuration written to ${path.relative(CWD, WRANGLER_TEMP_PATH)}`,
	);
}

// Function to ensure Durable Objects have migrations
function ensureDurableObjectMigrations(
	config: string,
	bindingsNode: any,
): string {
	let result = config;
	const tree = parseTree(result);
	if (!tree) return result;

	// Get all DO class names from bindings
	const doClassNames: string[] = [];
	for (const bindingNode of bindingsNode.children || []) {
		const classNameNode = findNodeAtLocation(bindingNode, ["class_name"]);
		if (classNameNode?.value) {
			doClassNames.push(classNameNode.value);
		}
	}

	if (doClassNames.length === 0) {
		return result;
	}

	// Check existing migrations
	const migrationsNode = findNodeAtLocation(tree, ["migrations"]);
	const existingClassesInMigrations = new Set<string>();

	if (migrationsNode?.children) {
		for (const migrationNode of migrationsNode.children) {
			// Check new_classes
			const newClassesNode = findNodeAtLocation(migrationNode, ["new_classes"]);
			if (newClassesNode?.children) {
				for (const classNode of newClassesNode.children) {
					if (classNode.value) {
						existingClassesInMigrations.add(classNode.value);
					}
				}
			}
			// Check new_sqlite_classes
			const newSqliteClassesNode = findNodeAtLocation(migrationNode, [
				"new_sqlite_classes",
			]);
			if (newSqliteClassesNode?.children) {
				for (const classNode of newSqliteClassesNode.children) {
					if (classNode.value) {
						existingClassesInMigrations.add(classNode.value);
					}
				}
			}
		}
	}

	// Find DO classes that don't have migrations
	const missingClasses = doClassNames.filter(
		(className) => !existingClassesInMigrations.has(className),
	);

	if (missingClasses.length > 0) {
		console.log(
			`Adding migrations for Durable Objects: ${missingClasses.join(", ")}`,
		);

		// Create a new migration with a descriptive tag
		const migrationTag = `auto-migration-add-${missingClasses.join("-")}`;
		const newMigration = {
			tag: migrationTag,
			new_classes: missingClasses,
		};

		// If no migrations exist, create a new migrations array
		if (!migrationsNode) {
			const edits = modify(
				result,
				["migrations"],
				[newMigration],
				{
					formattingOptions: {
						insertSpaces: false,
						tabSize: 1,
						eol: "\n",
					},
				},
			);
			result = applyEdits(result, edits);
		} else if (migrationsNode.children && migrationsNode.children.length > 0) {
			// Migrations exist, append a new migration
			const existingMigrations = migrationsNode.children.map(
				(node: any) => node.value,
			);
			const updatedMigrations = [...existingMigrations, newMigration];
			const edits = modify(
				result,
				["migrations"],
				updatedMigrations,
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

	return result;
}

// Ensure .env exists before creating configurations
ensureEnvExists();

createTypegenConfig();

console.log("Pre-typegen script completed successfully.");
