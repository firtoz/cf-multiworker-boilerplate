/**
 * Reads repo-root `.env.production` (required), finds `secrets.required` in each `wrangler-prod.jsonc`
 * under `apps/*` and `durable-objects/*`, and runs `wrangler secret put` when the value
 * changed vs a local hash cache (`.wrangler-secret-sync.json`).
 *
 * Options: `--force` — always push every secret (ignore hash cache).
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { findNodeAtLocation, parseTree } from "jsonc-parser";
import { getRepoRoot, loadEnvProductionStrict } from "./load-env-production";

const CACHE_FILENAME = ".wrangler-secret-sync.json";

loadEnvProductionStrict();
const root = getRepoRoot();
const cachePath = path.join(root, CACHE_FILENAME);

const force = process.argv.includes("--force");

type SecretCache = Record<string, string>;

function sha256Hex(value: string): string {
	return createHash("sha256").update(value, "utf8").digest("hex");
}

function loadCache(): SecretCache {
	try {
		const raw = fs.readFileSync(cachePath, "utf8");
		const parsed = JSON.parse(raw) as unknown;
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			return parsed as SecretCache;
		}
	} catch {
		// missing or invalid
	}
	return {};
}

function saveCache(cache: SecretCache): void {
	fs.writeFileSync(cachePath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
}

function parseWranglerProd(
	wranglerPath: string,
): { workerName: string; secretNames: string[] } | null {
	const content = fs.readFileSync(wranglerPath, "utf8");
	const tree = parseTree(content);
	if (!tree) {
		return null;
	}
	const nameNode = findNodeAtLocation(tree, ["name"]);
	const workerName =
		nameNode?.type === "string" && typeof nameNode.value === "string" ? nameNode.value : null;
	if (!workerName) {
		return null;
	}
	const requiredNode = findNodeAtLocation(tree, ["secrets", "required"]);
	if (!requiredNode || requiredNode.type !== "array") {
		return { workerName, secretNames: [] };
	}
	const secretNames: string[] = [];
	for (const el of requiredNode.children || []) {
		if (el.type === "string" && typeof el.value === "string") {
			secretNames.push(el.value);
		}
	}
	return { workerName, secretNames };
}

function collectWranglerProdPaths(): string[] {
	const out: string[] = [];
	for (const base of ["apps", "durable-objects"]) {
		const basePath = path.join(root, base);
		if (!fs.existsSync(basePath)) {
			continue;
		}
		for (const entry of fs.readdirSync(basePath, { withFileTypes: true })) {
			if (!entry.isDirectory()) {
				continue;
			}
			const wranglerProd = path.join(basePath, entry.name, "wrangler-prod.jsonc");
			if (fs.existsSync(wranglerProd)) {
				out.push(wranglerProd);
			}
		}
	}
	return out;
}

function secretPut(packageDir: string, secretName: string, value: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(
			"bunx",
			["wrangler", "secret", "put", secretName, "-c", "wrangler-prod.jsonc"],
			{
				cwd: packageDir,
				stdio: ["pipe", "inherit", "inherit"],
				env: process.env,
			},
		);
		if (!child.stdin) {
			reject(new Error("wrangler stdin pipe unavailable"));
			return;
		}
		child.stdin.write(value, "utf8");
		child.stdin.end();
		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`wrangler exited with code ${code}`));
			}
		});
	});
}

async function main(): Promise<void> {
	console.log("Syncing Wrangler secrets from repo-root .env.production …");
	if (force) {
		console.log("( --force: re-upload all secrets, ignore hash cache )\n");
	}

	const wranglerPaths = collectWranglerProdPaths();
	const cache = loadCache();
	let updated = false;
	let sawSecrets = false;

	for (const wranglerPath of wranglerPaths) {
		const parsed = parseWranglerProd(wranglerPath);
		if (!parsed || parsed.secretNames.length === 0) {
			continue;
		}
		sawSecrets = true;

		const packageDir = path.dirname(wranglerPath);
		const { workerName, secretNames } = parsed;

		for (const secretName of secretNames) {
			const value = process.env[secretName];
			if (value === undefined || value === "") {
				const envFile = path.join(root, ".env.production");
				console.error("");
				console.error(`  Missing or empty: ${secretName}`);
				console.error(`  Worker: ${workerName} (secrets.required in wrangler-prod)`);
				console.error(`  Set it in: ${envFile}`);
				console.error("  .env.local is not loaded for this step.");
				console.error("");
				process.exit(1);
			}

			const cacheKey = `${workerName}:${secretName}`;
			const nextHash = sha256Hex(value);
			if (!force && cache[cacheKey] === nextHash) {
				console.log(`  Skip (unchanged): ${cacheKey}`);
				continue;
			}

			console.log(`  Pushing secret: ${cacheKey}`);
			try {
				await secretPut(packageDir, secretName, value);
			} catch (err) {
				console.error(`  wrangler secret put failed for ${cacheKey}:`, err);
				process.exit(1);
			}
			cache[cacheKey] = nextHash;
			updated = true;
		}
	}

	if (!sawSecrets) {
		console.log("\nNo secrets.required entries in any wrangler-prod.jsonc — nothing to do.");
		return;
	}

	if (updated) {
		saveCache(cache);
		console.log(`\n✓ Wrote ${CACHE_FILENAME}`);
	} else {
		console.log(`\n✓ All secrets match cache — nothing to push. Use --force to re-upload.`);
	}
}

await main();
