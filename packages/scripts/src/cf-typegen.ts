#!/usr/bin/env bun
/**
 * Wrangler types for workspace packages. Requires `--apps-web-config=<basename>` (e.g.
 * wrangler-dev.jsonc | wrangler-prod.jsonc) so apps/web uses an explicit generated file.
 */
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { findWorkspaceRoot, getWorkspacePaths } from "@firtoz/worker-helper/cf-typegen-discovery";

function parseArgs(argv: string[]): {
	cwd: string;
	appsWebBasename: string;
	wranglerPassthrough: string[];
} {
	const cwdArg = argv[0];
	const rest = argv.slice(1);
	let appsWebBasename = "";
	const wranglerPassthrough: string[] = [];
	for (const a of rest) {
		if (a.startsWith("--apps-web-config=")) {
			appsWebBasename = a.slice("--apps-web-config=".length).trim();
		} else {
			wranglerPassthrough.push(a);
		}
	}
	if (!appsWebBasename) {
		console.error(
			"Missing required flag: --apps-web-config=wrangler-dev.jsonc (or wrangler-prod.jsonc)",
		);
		process.exit(1);
	}
	return { cwd: cwdArg ?? "", appsWebBasename, wranglerPassthrough };
}

const { cwd, appsWebBasename, wranglerPassthrough } = parseArgs(process.argv.slice(2));

if (!cwd || !fs.existsSync(cwd)) {
	console.error("Please specify a directory as the first parameter. Usually $(pwd).");
	process.exit(1);
}

function webConfigPath(workspaceRoot: string): string {
	return path.join(workspaceRoot, "apps", "web", appsWebBasename);
}

/**
 * Prefer generated wrangler-dev.jsonc / wrangler-prod.jsonc per package when present,
 * since committed wrangler.jsonc may be removed in favor of wrangler.jsonc.hbs.
 */
function discoverWranglerConfigsPreferGenerated(
	workspaceRoot: string,
	generatedBasename: string,
): string[] {
	const memberDirs = getWorkspacePaths(workspaceRoot);
	const out: string[] = [];
	for (const dir of memberDirs) {
		const gen = path.join(dir, generatedBasename);
		const legacyJsonc = path.join(dir, "wrangler.jsonc");
		const legacyJson = path.join(dir, "wrangler.json");
		if (fs.existsSync(gen)) {
			out.push(gen);
		} else if (fs.existsSync(legacyJsonc)) {
			out.push(legacyJsonc);
		} else if (fs.existsSync(legacyJson)) {
			out.push(legacyJson);
		}
	}
	return out.sort((a, b) => (a < b ? -1 : 1));
}

function normalizeDiscoveryList(workspaceRoot: string | null, configs: string[]): string[] {
	const webResolved = workspaceRoot ? webConfigPath(workspaceRoot) : "";
	const out: string[] = [];
	const seen = new Set<string>();
	for (const p of configs) {
		const norm = p.replace(/\\/g, "/");
		let use = p;
		if (
			norm.endsWith("apps/web/wrangler.jsonc") ||
			norm.endsWith("apps/web/wrangler-dev.jsonc") ||
			norm.endsWith("apps/web/wrangler-prod.jsonc")
		) {
			if (workspaceRoot && fs.existsSync(webResolved)) {
				use = webResolved;
			}
		}
		const abs = path.resolve(use);
		if (!seen.has(abs)) {
			seen.add(abs);
			out.push(use);
		}
	}
	if (workspaceRoot && fs.existsSync(webResolved)) {
		const abs = path.resolve(webResolved);
		if (!seen.has(abs)) {
			out.push(webResolved);
			seen.add(abs);
		}
	}
	return out.sort((a, b) => (a < b ? -1 : 1));
}

/**
 * Only real env files beside this package — never `.env.example` (that file is documentation-only).
 * Order: `.env` then `.env.local` (later overrides).
 */
function realEnvFilesBesidePackage(cwdDir: string): string[] {
	const names = [".env", ".env.local"] as const;
	return names.filter((n) => fs.existsSync(path.join(cwdDir, n)));
}

/** Wrangler fails if `--env-file` points at a missing path; missing files are skipped (CI may have none). */
function pushEnvFileIfExists(args: string[], cwdDir: string, relPath: string): void {
	const resolved = path.isAbsolute(relPath) ? relPath : path.resolve(cwdDir, relPath);
	if (fs.existsSync(resolved)) {
		args.push("--env-file", relPath);
	} else {
		console.warn(`  Skipping missing env file for wrangler types: ${relPath}`);
	}
}

/** Strip or keep `--env-file <path>` pairs based on file existence (paths relative to cwdDir). */
function filterPassthroughEnvFiles(cwdDir: string, passthrough: string[]): string[] {
	const out: string[] = [];
	for (let i = 0; i < passthrough.length; i++) {
		const a = passthrough[i];
		if (a === "--env-file" && i + 1 < passthrough.length) {
			const p = passthrough[i + 1];
			if (p === undefined) {
				break;
			}
			const resolved = path.isAbsolute(p) ? p : path.resolve(cwdDir, p);
			if (fs.existsSync(resolved)) {
				out.push("--env-file", p);
			} else {
				console.warn(`  Skipping missing env file for wrangler types: ${p}`);
			}
			i += 1;
			continue;
		}
		out.push(a);
	}
	return out;
}

function primaryConfigRelative(cwdDir: string, workspaceRoot: string | null): string {
	const webDir = workspaceRoot ? path.join(workspaceRoot, "apps", "web") : "";
	const isWeb = webDir !== "" && path.resolve(cwdDir) === path.resolve(webDir);
	const generatedInCwd = path.join(cwdDir, appsWebBasename);
	if (fs.existsSync(generatedInCwd)) {
		return appsWebBasename;
	}
	if (isWeb && workspaceRoot) {
		console.error(
			`Missing ${appsWebBasename} in ${cwdDir}. Run generate-wrangler:local or generate-wrangler:prod first.`,
		);
		process.exit(1);
	}
	const jsonc = path.join(cwdDir, "wrangler.jsonc");
	if (fs.existsSync(jsonc)) {
		return "wrangler.jsonc";
	}
	const json = path.join(cwdDir, "wrangler.json");
	if (fs.existsSync(json)) {
		return "wrangler.json";
	}
	console.error(
		`No ${appsWebBasename} or wrangler.jsonc found in ${cwdDir}. Run generate-wrangler first.`,
	);
	process.exit(1);
}

console.log(`Running CF typegen for: ${cwd}`);

function runWranglerTypes() {
	const envFiles = realEnvFilesBesidePackage(cwd);

	console.log("Running wrangler types...");

	const workspaceRoot = findWorkspaceRoot(cwd);
	let allConfigs: string[];
	if (workspaceRoot) {
		allConfigs = normalizeDiscoveryList(
			workspaceRoot,
			discoverWranglerConfigsPreferGenerated(workspaceRoot, appsWebBasename),
		);
	} else {
		console.warn("⚠ No workspace root found, using current directory only");
		allConfigs = [];
	}

	if (allConfigs.length > 0) {
		console.log(`  Found ${allConfigs.length} wrangler config(s) in workspace`);
	}

	const primary = primaryConfigRelative(cwd, workspaceRoot);
	const args: string[] = ["types", "-c", primary];

	const primaryResolved = path.resolve(cwd, primary);
	const legacyJsonc = path.resolve(cwd, "wrangler.jsonc");
	const legacyJson = path.resolve(cwd, "wrangler.json");

	for (const configPath of allConfigs) {
		const resolvedPath = path.resolve(configPath);
		if (
			resolvedPath === primaryResolved ||
			resolvedPath === legacyJsonc ||
			resolvedPath === legacyJson
		) {
			continue;
		}
		const relativePath = path.relative(cwd, configPath);
		args.push("-c", relativePath);
	}

	for (const envFile of envFiles) {
		pushEnvFileIfExists(args, cwd, envFile);
	}

	args.push(...filterPassthroughEnvFiles(cwd, wranglerPassthrough));

	const command = `wrangler ${args.join(" ")}`;
	console.log(`  Command: ${command}`);

	const result = spawnSync("wrangler", args, {
		cwd,
		stdio: "inherit",
	});
	if (result.status !== 0) {
		console.error("Failed to run wrangler types");
		process.exit(1);
	}
	console.log("✓ Wrangler types generated with all workspace bindings");
}

try {
	runWranglerTypes();
	console.log("\n✓ CF typegen completed successfully");
} catch (error: unknown) {
	console.error("\n✗ CF typegen failed:", error);
	process.exit(1);
}
