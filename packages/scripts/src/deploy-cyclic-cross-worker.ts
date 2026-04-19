#!/usr/bin/env bun
/**
 * Generic **`deploy`** entry for any worker package under **`apps/`** or **`durable-objects/`** that
 * uses `wrangler-prod.jsonc`. Discovers **2-node** cross-script DO cycles from generated prod
 * configs; if this worker participates:
 * - **healthy** (`wrangler deploy --dry-run` OK for both scripts): **one** full deploy for **this**
 *   package only.
 * - **needs phased**: only the **pipeline primary** Worker (see `resolvePipelinePrimaryForPair` in
 *   `worker-script-cycle-bootstrap.ts`) runs `runPhasedTwoNodeCycleDeploy`; the other package’s
 *   `deploy` is a no-op in the same pipeline.
 *
 * Query: **`bun ./deploy-cyclic-cross-worker.ts --status`** (from repo root or `packages/scripts`).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { config as dotenvConfig } from "dotenv";
import { getRepoRoot, loadEnvProductionStrict } from "./load-env-production";
import { parseJsonc } from "./utils/parse-jsonc";
import {
	buildGraph,
	findTwoNodeCyclicSccs,
	queryTwoNodeCrossScriptCyclesHealth,
	resolvePipelinePrimaryForPair,
	runPhasedTwoNodeCycleDeploy,
	runWranglerDeploy,
	sccHasCycle,
	tarjanScc,
	twoNodeCycleFullConfigDryRunOk,
} from "./utils/worker-script-cycle-bootstrap";

async function printStatus(repoRoot: string): Promise<void> {
	const prodEnv = path.join(repoRoot, ".env.production");
	if (fs.existsSync(prodEnv)) {
		dotenvConfig({ path: prodEnv, override: true });
	}
	const rows = await queryTwoNodeCrossScriptCyclesHealth(repoRoot);
	console.log(JSON.stringify(rows, null, 2));
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const repoRoot = getRepoRoot();

	if (args.includes("--status")) {
		await printStatus(repoRoot);
		return;
	}

	loadEnvProductionStrict();

	const packageDir = process.cwd();
	const prodPath = path.join(packageDir, "wrangler-prod.jsonc");

	if (!fs.existsSync(prodPath)) {
		console.error(`Missing ${prodPath} — run generate-wrangler:prod first.`);
		process.exit(1);
	}

	const raw = fs.readFileSync(prodPath, "utf8");
	const workerName = parseJsonc<{ name?: string }>(raw).name;
	if (typeof workerName !== "string" || !workerName) {
		console.error("wrangler-prod.jsonc must have a string top-level \"name\".");
		process.exit(1);
	}

	const { scriptToPackageDir, edges, vertices } = buildGraph(repoRoot);
	const sccs = tarjanScc([...vertices], edges);
	const badCycle = sccs.find(
		(c) => sccHasCycle(c, edges) && c.length > 2 && c.includes(workerName),
	);
	if (badCycle) {
		console.error(
			`Unsupported: "${workerName}" is in a cross-script DO cycle of size ${badCycle.length}. Only 2-node cycles are automated.`,
		);
		process.exit(1);
	}

	const pairs = findTwoNodeCyclicSccs(edges, vertices);
	const myPair = pairs.find((p) => p.includes(workerName));

	if (!myPair) {
		console.log(`\nNo 2-node cross-script DO cycle includes "${workerName}" — single full deploy.\n`);
		await runWranglerDeploy(packageDir, prodPath);
		return;
	}

	const [a, b] = [...myPair].sort((x, y) => x.localeCompare(y)) as [string, string];
	const { primary, secondary } = resolvePipelinePrimaryForPair([a, b]);
	const ok = await twoNodeCycleFullConfigDryRunOk(myPair, scriptToPackageDir);

	if (ok) {
		console.log(
			`\n✓ Cross-script cycle [${a}, ${b}] — \`wrangler deploy --dry-run\` OK for both; deploying only ${workerName} (full).\n`,
		);
		await runWranglerDeploy(packageDir, prodPath);
		return;
	}

	if (workerName === primary) {
		console.log(
			`\nCross-script cycle [${a}, ${b}] — full configs not yet deployable; running phased deploy (pipeline primary: ${primary})…`,
		);
		await runPhasedTwoNodeCycleDeploy(myPair, scriptToPackageDir);
		return;
	}

	console.log(
		`\n⏭  Skip deploy for "${workerName}" — pipeline primary is "${primary}" (runs phased when needed). "${secondary}" should be deployed afterward in the same Turbo run.\n`,
	);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
