/**
 * Cross-script `script_name` Durable Object bindings form a directed graph. **2-node** SCCs with
 * cycles need a **phased** `wrangler deploy` when full configs are not yet deployable (dry-run
 * fails): strip intra-SCC remote bindings on the **lexicographically smaller** script, deploy it,
 * deploy the **larger** script full, then deploy the smaller full again.
 *
 * **Pipeline primary** (which package’s `deploy` runs phased when needed) defaults to the **lex
 * larger** script name in the pair so typical Turbo order (e.g. `…-coordinator-do` < `…-processor-do`,
 * deploy `processor-do` first) stays consistent. Align Turbo `deploy` task order with that
 * convention, or set **`PIPELINE_PRIMARY_SCRIPT`** to override.
 *
 * **pre-deploy** only logs cycles; it does not deploy.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { findNodeAtLocation, parseTree } from "jsonc-parser";
import { parseJsonc } from "./parse-jsonc";

export type WorkerEdge = { from: string; to: string };

/** Parse wrangler JSONC enough for `name` and durable_objects.bindings script_name refs. */
function parseWranglerForGraph(raw: string): { name: string | null; remoteScriptNames: string[] } {
	const tree = parseTree(raw);
	if (!tree) {
		return { name: null, remoteScriptNames: [] };
	}
	const nameNode = findNodeAtLocation(tree, ["name"]);
	const name = typeof nameNode?.value === "string" ? nameNode.value : null;
	const remote: string[] = [];
	const bindingsRoot = findNodeAtLocation(tree, ["durable_objects", "bindings"]);
	if (bindingsRoot?.type === "array") {
		for (const binding of bindingsRoot.children ?? []) {
			if (binding?.type !== "object" || !binding.children) {
				continue;
			}
			const sn = findNodeAtLocation(binding, ["script_name"]);
			if (typeof sn?.value === "string") {
				remote.push(sn.value);
			}
		}
	}
	return { name, remoteScriptNames: remote };
}

function listWranglerProdPaths(repoRoot: string): string[] {
	const out: string[] = [];
	for (const base of ["apps", "durable-objects"]) {
		const basePath = path.join(repoRoot, base);
		if (!fs.existsSync(basePath)) {
			continue;
		}
		for (const entry of fs.readdirSync(basePath, { withFileTypes: true })) {
			if (!entry.isDirectory()) {
				continue;
			}
			const p = path.join(basePath, entry.name, "wrangler-prod.jsonc");
			if (fs.existsSync(p)) {
				out.push(p);
			}
		}
	}
	return out;
}

export function buildGraph(repoRoot: string): {
	scriptToPackageDir: Map<string, string>;
	edges: WorkerEdge[];
	vertices: Set<string>;
} {
	const scriptToPackageDir = new Map<string, string>();
	const edges: WorkerEdge[] = [];
	const vertices = new Set<string>();

	for (const wrPath of listWranglerProdPaths(repoRoot)) {
		const raw = fs.readFileSync(wrPath, "utf8");
		const { name, remoteScriptNames } = parseWranglerForGraph(raw);
		if (!name) {
			continue;
		}
		const pkgDir = path.dirname(wrPath);
		scriptToPackageDir.set(name, pkgDir);
		vertices.add(name);
		for (const to of remoteScriptNames) {
			vertices.add(to);
			edges.push({ from: name, to });
		}
	}

	return { scriptToPackageDir, edges, vertices };
}

/** Tarjan's SCC. Returns list of components (each is array of vertex ids). */
export function tarjanScc(vertices: string[], edges: WorkerEdge[]): string[][] {
	const adj = new Map<string, string[]>();
	for (const v of vertices) {
		adj.set(v, []);
	}
	for (const e of edges) {
		if (adj.has(e.from) && adj.has(e.to)) {
			adj.get(e.from)?.push(e.to);
		}
	}

	let index = 0;
	const stack: string[] = [];
	const onStack = new Set<string>();
	const indices = new Map<string, number>();
	const lowlink = new Map<string, number>();
	const sccs: string[][] = [];

	function strongConnect(v: string): void {
		indices.set(v, index);
		lowlink.set(v, index);
		index += 1;
		stack.push(v);
		onStack.add(v);

		for (const w of adj.get(v) ?? []) {
			if (!indices.has(w)) {
				strongConnect(w);
				lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
			} else if (onStack.has(w)) {
				lowlink.set(v, Math.min(lowlink.get(v)!, indices.get(w)!));
			}
		}

		if (lowlink.get(v) === indices.get(v)) {
			const comp: string[] = [];
			let w: string | undefined;
			do {
				w = stack.pop();
				if (w !== undefined) {
					onStack.delete(w);
					comp.push(w);
				}
			} while (w !== v);
			sccs.push(comp);
		}
	}

	for (const v of vertices) {
		if (!indices.has(v)) {
			strongConnect(v);
		}
	}

	return sccs;
}

export function sccHasCycle(comp: string[], edges: WorkerEdge[]): boolean {
	if (comp.length >= 2) {
		return true;
	}
	if (comp.length === 1) {
		const v = comp[0];
		return edges.some((e) => e.from === v && e.to === v);
	}
	return false;
}

function parseWranglerConfigObject(raw: string): Record<string, unknown> {
	return parseJsonc<Record<string, unknown>>(raw);
}

/** Remove `durable_objects` bindings whose `script_name` points at another script in the SCC. */
export function stripBindingsToScriptSet(
	config: Record<string, unknown>,
	scc: Set<string>,
): Record<string, unknown> {
	const doRoot = config.durable_objects as { bindings?: unknown[] } | undefined;
	if (!doRoot?.bindings || !Array.isArray(doRoot.bindings)) {
		return config;
	}
	const next = doRoot.bindings.filter((b) => {
		if (!b || typeof b !== "object") {
			return true;
		}
		const o = b as Record<string, unknown>;
		const sn = o.script_name;
		if (typeof sn === "string" && scc.has(sn)) {
			return false;
		}
		return true;
	});
	return {
		...config,
		durable_objects: {
			...doRoot,
			bindings: next,
		},
	};
}

export function runWranglerDeploy(cwd: string, configFile: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const absConfig = path.isAbsolute(configFile) ? configFile : path.resolve(cwd, configFile);
		const child = spawn("bunx", ["wrangler", "deploy", "-c", absConfig], {
			cwd,
			stdio: "inherit",
			env: process.env,
		});
		child.on("close", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`wrangler deploy exited with ${code}`));
			}
		});
		child.on("error", reject);
	});
}

/** Exit code from `wrangler deploy` (0 = success). Supports `--dry-run` for health checks. */
export function wranglerDeployExitCode(
	cwd: string,
	configFile: string,
	options?: { dryRun?: boolean },
): Promise<number> {
	const absConfig = path.isAbsolute(configFile) ? configFile : path.resolve(cwd, configFile);
	const args = ["wrangler", "deploy"];
	if (options?.dryRun) {
		args.push("--dry-run");
	}
	args.push("-c", absConfig);
	return new Promise((resolve, reject) => {
		const child = spawn("bunx", args, {
			cwd,
			stdio: ["ignore", "pipe", "pipe"],
			env: process.env,
		});
		child.on("close", (code) => {
			resolve(code ?? 1);
		});
		child.on("error", reject);
	});
}

/** All 2-node SCCs that participate in a (`script_name`) cycle. */
export function findTwoNodeCyclicSccs(edges: WorkerEdge[], vertices: Set<string>): string[][] {
	const sccs = tarjanScc([...vertices], edges);
	return sccs.filter((c) => c.length === 2 && sccHasCycle(c, edges));
}

export type TwoNodeCycleHealth = {
	scripts: [string, string];
	/** Lexicographically smaller script — receives stripped deploy step 1 & 3 in phased sequence. */
	algorithmFirst: string;
	/** Lexicographically larger script. */
	algorithmSecond: string;
	/** Which Worker name must run **`deploy`** first in the pipeline when phased deploy is needed (`PIPELINE_PRIMARY_SCRIPT` or default: same as `algorithmSecond`). */
	pipelinePrimary: string;
	pipelineSecondary: string;
	fullConfigDryRunOk: boolean;
	needsPhasedDeploy: boolean;
};

/** `wrangler deploy --dry-run` succeeds for **both** workers with full prod configs. */
export async function twoNodeCycleFullConfigDryRunOk(
	pair: string[],
	scriptToPackageDir: Map<string, string>,
): Promise<boolean> {
	if (pair.length !== 2) {
		return false;
	}
	for (const script of pair) {
		const dir = scriptToPackageDir.get(script);
		if (!dir) {
			return false;
		}
		const prod = path.join(dir, "wrangler-prod.jsonc");
		if (!fs.existsSync(prod)) {
			return false;
		}
		const code = await wranglerDeployExitCode(dir, prod, { dryRun: true });
		if (code !== 0) {
			return false;
		}
	}
	return true;
}

/**
 * Resolve which script’s package should run **phased** deploy when dry-run fails. Override with env
 * **`PIPELINE_PRIMARY_SCRIPT`** (must be one of the two Worker `name`s in the cycle).
 */
export function resolvePipelinePrimaryForPair(
	pair: readonly [string, string],
): { primary: string; secondary: string } {
	const [a, b] = [...pair].sort((x, y) => x.localeCompare(y)) as [string, string];
	const override = process.env.PIPELINE_PRIMARY_SCRIPT?.trim();
	if (override && (override === a || override === b)) {
		return { primary: override, secondary: override === a ? b : a };
	}
	/** Default: lex **larger** — matches common Turbo ordering (e.g. processor after coordinator by name). */
	return { primary: b, secondary: a };
}

/** Inspect every 2-node cross-script DO cycle (for CI / `deploy-cyclic-cross-worker.ts --status`). */
export async function queryTwoNodeCrossScriptCyclesHealth(
	repoRoot: string,
): Promise<TwoNodeCycleHealth[]> {
	const { scriptToPackageDir, edges, vertices } = buildGraph(repoRoot);
	const pairs = findTwoNodeCyclicSccs(edges, vertices);
	const out: TwoNodeCycleHealth[] = [];
	for (const comp of pairs) {
		const [a, b] = [...comp].sort((x, y) => x.localeCompare(y)) as [string, string];
		const { primary, secondary } = resolvePipelinePrimaryForPair([a, b]);
		const ok = await twoNodeCycleFullConfigDryRunOk(comp, scriptToPackageDir);
		out.push({
			scripts: [a, b],
			algorithmFirst: a,
			algorithmSecond: b,
			pipelinePrimary: primary,
			pipelineSecondary: secondary,
			fullConfigDryRunOk: ok,
			needsPhasedDeploy: !ok,
		});
	}
	return out;
}

/**
 * Deploy A stripped → B full → A full (A = lexicographically first script name in the pair).
 * Uses real package sources under each `wrangler-prod.jsonc` (not placeholders).
 */
export async function runPhasedTwoNodeCycleDeploy(
	comp: string[],
	scriptToPackageDir: Map<string, string>,
): Promise<void> {
	if (comp.length !== 2) {
		throw new Error(
			`runPhasedTwoNodeCycleDeploy expects a 2-script SCC, got ${comp.length}: ${comp.join(", ")}`,
		);
	}
	const sccSet = new Set(comp);
	const [first, second] = [...comp].sort((a, b) => a.localeCompare(b));
	const firstDir = scriptToPackageDir.get(first);
	const secondDir = scriptToPackageDir.get(second);
	if (!firstDir || !secondDir) {
		throw new Error(`Missing package directory for cyclic scripts: ${comp.join(", ")}`);
	}
	const firstProd = path.join(firstDir, "wrangler-prod.jsonc");
	const secondProd = path.join(secondDir, "wrangler-prod.jsonc");
	const rawFirst = fs.readFileSync(firstProd, "utf8");
	const strippedFirst = stripBindingsToScriptSet(parseWranglerConfigObject(rawFirst), sccSet);
	// Config must live next to `main` — Wrangler resolves `./workers/app.ts` relative to the
	// config file path, not `--cwd` (a file in /tmp breaks entry resolution).
	const tmp = path.join(
		firstDir,
		`wrangler-phased-strip-${first.replace(/[^a-z0-9_-]/gi, "_")}-${Date.now()}.json`,
	);
	fs.writeFileSync(tmp, `${JSON.stringify(strippedFirst, null, 2)}\n`, "utf8");
	try {
		console.log(
			`\n[1/3] Deploy ${first} (strip remote DO bindings to the other script in this cycle)…`,
		);
		await runWranglerDeploy(firstDir, tmp);
		console.log(`\n[2/3] Deploy ${second} (full config)…`);
		await runWranglerDeploy(secondDir, secondProd);
		console.log(`\n[3/3] Deploy ${first} (full config)…`);
		await runWranglerDeploy(firstDir, firstProd);
	} finally {
		try {
			fs.unlinkSync(tmp);
		} catch {
			/* ignore */
		}
	}
	console.log(`\n✓ Phased deploy finished for cycle [${first}, ${second}]\n`);
}

/**
 * Logs cyclic cross-script DO graphs. Deploy order is enforced by **processor-do** phased deploy,
 * not here (pre-deploy runs before per-package deploy tasks).
 */
export async function bootstrapCircularCrossScriptDOBindings(repoRoot: string): Promise<void> {
	const { edges, vertices } = buildGraph(repoRoot);
	const sccs = tarjanScc([...vertices], edges);
	const cyclic = sccs.filter((c) => sccHasCycle(c, edges));
	if (cyclic.length === 0) {
		console.log("\nNo cyclic cross-script Durable Object bindings detected.\n");
		return;
	}
	console.log("\nCross-script DO cycle(s) in prod wrangler configs:");
	for (const c of cyclic) {
		console.log(`  • [${c.join(", ")}]`);
	}
	console.log(
		"  Use **`bun ./packages/scripts/src/deploy-cyclic-cross-worker.ts --status`** for dry-run health. Phased deploy runs from the **pipeline primary** package when needed (see `resolvePipelinePrimaryForPair`).\n",
	);
}
