#!/usr/bin/env bun

/**
 * Generate wrangler-dev.jsonc (local) or wrangler-prod.jsonc (remote) from wrangler.jsonc.hbs
 * in the current working directory (apps/web or durable-objects/*).
 *
 * Remote (`--mode=remote`): repo-root `.env.production` merges `DEPLOYMENT_KEYS` and any `*_WORKER_NAME`
 * (merged on top of `process.env`). CI sets the same keys without a file.
 *
 * Local: `LOCAL_DEFAULTS` + optional `cwd/.env` + repo-root `.env.local`, then `process.env`.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { parse as parseDotenv } from "dotenv";

type Mode = "local" | "remote";

const REPO_ROOT_PACKAGE_NAME = "cf-multiworker-boilerplate";

const LOCAL_DEFAULTS: Record<string, string> = {
	WEB_WORKER_NAME: "cf-web-app-dev",
	EXAMPLE_DO_WORKER_NAME: "cf-example-do-dev",
	COORDINATOR_DO_WORKER_NAME: "cf-coordinator-do-dev",
	PROCESSOR_DO_WORKER_NAME: "cf-processor-do-dev",
};

const PROD_DEFAULTS: Record<string, string> = {
	WEB_WORKER_NAME: "cf-web-app",
	EXAMPLE_DO_WORKER_NAME: "cf-example-do",
	COORDINATOR_DO_WORKER_NAME: "cf-coordinator-do",
	PROCESSOR_DO_WORKER_NAME: "cf-processor-do",
};

/** Keys read from repo-root `.env.production` for remote wrangler (same names can be set in CI `process.env`). */
const DEPLOYMENT_KEYS = [
	"ROUTES",
	"ROUTES_ZONE_NAME",
	"WEB_WORKER_NAME",
	"EXAMPLE_DO_WORKER_NAME",
	"COORDINATOR_DO_WORKER_NAME",
	"PROCESSOR_DO_WORKER_NAME",
] as const;

/**
 * Env key for `{{WORKER_NAME}}` substitution: `apps/web` → `WEB_WORKER_NAME`;
 * `durable-objects/foo-bar` → `FOO_BAR_WORKER_NAME` (kebab folder → UPPER_SNAKE + `_WORKER_NAME`).
 */
function workerNameEnvKeyForPackageDir(packageRelDir: string): string {
	if (packageRelDir === "apps/web") {
		return "WEB_WORKER_NAME";
	}
	const m = /^durable-objects\/([^/]+)$/.exec(packageRelDir);
	if (m) {
		const folder = m[1];
		return `${folder.replace(/-/g, "_").toUpperCase()}_WORKER_NAME`;
	}
	throw new Error(`Unknown package directory for wrangler template: ${packageRelDir}`);
}

function defaultWorkerNameForDurableObjectFolder(folder: string, mode: Mode): string {
	return mode === "local" ? `cf-${folder}-dev` : `cf-${folder}`;
}

function findRepoRoot(startDir: string): string {
	let dir = path.resolve(startDir);
	for (;;) {
		const pkg = path.join(dir, "package.json");
		if (fs.existsSync(pkg)) {
			try {
				const j = JSON.parse(fs.readFileSync(pkg, "utf8")) as { name?: string };
				if (j.name === REPO_ROOT_PACKAGE_NAME) {
					return dir;
				}
			} catch {
				/* ignore */
			}
		}
		const parent = path.dirname(dir);
		if (parent === dir) {
			return startDir;
		}
		dir = parent;
	}
}

function loadEnvFile(envPath: string): Record<string, string> {
	if (!fs.existsSync(envPath)) {
		return {};
	}
	try {
		return parseDotenv(fs.readFileSync(envPath, "utf8"));
	} catch (e) {
		console.warn(`Warning: could not read ${envPath}:`, e);
		return {};
	}
}

function processEnvSnapshot(): Record<string, string> {
	return Object.fromEntries(
		Object.entries(process.env).filter(([, v]) => v !== undefined) as [string, string][],
	);
}

/**
 * process.env first; repo-root `.env.production` overwrites `DEPLOYMENT_KEYS` and any `*_WORKER_NAME`
 * (so new `durable-objects/*` workers do not need a code change).
 */
function mergeEnvForRemote(fileEnv: Record<string, string>): Record<string, string> {
	const base = processEnvSnapshot();
	const out = { ...base };
	for (const k of DEPLOYMENT_KEYS) {
		const v = fileEnv[k]?.trim();
		if (v !== undefined && v !== "") {
			out[k] = v;
		}
	}
	for (const [k, v] of Object.entries(fileEnv)) {
		if (!k.endsWith("_WORKER_NAME")) {
			continue;
		}
		const t = v?.trim();
		if (t) {
			out[k] = t;
		}
	}
	return out;
}

function parseMode(): Mode {
	const modeArg = process.argv.find((a) => a.startsWith("--mode="));
	if (modeArg) {
		const m = modeArg.split("=")[1] as Mode;
		if (m === "local" || m === "remote") {
			return m;
		}
		console.warn(`Invalid --mode, falling back to WRANGLER_MODE / local`);
	}
	const fromEnv = process.env.WRANGLER_MODE?.trim();
	if (fromEnv === "local" || fromEnv === "remote") {
		return fromEnv;
	}
	return "local";
}

/**
 * Comma-separated hostnames (optional legacy `/*` suffix is stripped).
 */
function formatRoutes(routesStr: string, routesZoneName?: string): string {
	if (!routesStr?.trim()) {
		return "";
	}

	const routeList = routesStr
		.split(",")
		.map((r) => r.trim())
		.filter((r) => r.length > 0);

	if (routeList.length === 0) {
		return "";
	}

	const customDomainRoutes = routeList
		.map((r) => {
			const host = r.replace(/\/\*$/, "").trim();
			return `{ "pattern": "${host}", "custom_domain": true }`;
		})
		.join(", ");

	const wildcardRoutes: string[] = [];
	if (routesZoneName?.trim()) {
		const zone = routesZoneName.trim();
		for (const r of routeList) {
			const domain = r.replace(/\/\*$/, "").trim();
			if (domain && !domain.includes("*")) {
				wildcardRoutes.push(`{ "pattern": "*.${domain}/*", "zone_name": "${zone}" }`);
			}
		}
	}

	const all =
		wildcardRoutes.length > 0
			? [customDomainRoutes, wildcardRoutes.join(", ")].join(", ")
			: customDomainRoutes;

	return `"routes": [${all}],`;
}

function workersDevAndRoutesBlock(mode: Mode, env: Record<string, string>): string {
	if (mode === "local") {
		return `"workers_dev": true,`;
	}

	const routes = env.ROUTES?.trim();
	const zone = env.ROUTES_ZONE_NAME?.trim();
	if (!routes) {
		return `"workers_dev": true,`;
	}
	const routesBlock = formatRoutes(routes, zone);
	return `"workers_dev": false,\n\t${routesBlock}`;
}

function buildSubstitutionMap(
	mode: Mode,
	packageRelDir: string,
	env: Record<string, string>,
): Record<string, string> {
	const defaults = mode === "local" ? LOCAL_DEFAULTS : PROD_DEFAULTS;
	const workerKey = workerNameEnvKeyForPackageDir(packageRelDir);
	const doFolder = /^durable-objects\/([^/]+)$/.exec(packageRelDir)?.[1];

	const fromDefaults = defaults[workerKey as keyof typeof defaults];
	const workerName =
		env[workerKey]?.trim() ||
		(fromDefaults ?? "") ||
		(doFolder ? defaultWorkerNameForDurableObjectFolder(doFolder, mode) : "") ||
		env.WORKER_NAME?.trim() ||
		"";

	const map: Record<string, string> = {
		...defaults,
		WORKER_NAME: workerName,
		WORKERS_DEV_BLOCK: workersDevAndRoutesBlock(mode, env),
	};

	for (const k of [
		"WEB_WORKER_NAME",
		"EXAMPLE_DO_WORKER_NAME",
		"COORDINATOR_DO_WORKER_NAME",
		"PROCESSOR_DO_WORKER_NAME",
	] as const) {
		map[k] = env[k]?.trim() || defaults[k] || "";
	}

	for (const [k, v] of Object.entries(env)) {
		if (k.endsWith("_WORKER_NAME") && v?.trim()) {
			map[k] = v.trim();
		}
	}

	return map;
}

function applyTemplate(template: string, substitutions: Record<string, string>): string {
	let out = template;
	for (const [key, value] of Object.entries(substitutions)) {
		out = out.replaceAll(`{{${key}}}`, value);
	}
	return out;
}

export async function generateWranglerConfig(): Promise<boolean> {
	const mode = parseMode();
	const cwd = process.cwd();
	const templatePath = path.join(cwd, "wrangler.jsonc.hbs");
	const outputPath = path.join(
		cwd,
		mode === "local" ? "wrangler-dev.jsonc" : "wrangler-prod.jsonc",
	);
	const repoRoot = findRepoRoot(cwd);
	const packageRelDir = path.relative(repoRoot, cwd).replace(/\\/g, "/");

	if (!fs.existsSync(templatePath)) {
		throw new Error(
			`Template not found: ${templatePath}\nCommit wrangler.jsonc.hbs in this directory.`,
		);
	}

	const rootLocal = loadEnvFile(path.join(repoRoot, ".env.local"));
	const packageDotEnv = loadEnvFile(path.join(cwd, ".env"));
	const mergedLocal = { ...packageDotEnv, ...rootLocal };

	let env: Record<string, string>;
	if (mode === "local") {
		env = {
			...LOCAL_DEFAULTS,
			...mergedLocal,
			...processEnvSnapshot(),
		};
	} else {
		const rootProd = loadEnvFile(path.join(repoRoot, ".env.production"));
		if (Object.keys(rootProd).length > 0) {
			console.log(`Loaded repo-root .env.production (deployment keys merge with process.env)`);
		}
		env = mergeEnvForRemote(rootProd);
		for (const [k, v] of Object.entries(PROD_DEFAULTS)) {
			if (env[k] === undefined || env[k] === "") {
				env[k] = v;
			}
		}
	}

	const substitutions = buildSubstitutionMap(mode, packageRelDir, env);
	let template = fs.readFileSync(templatePath, "utf8");
	template = applyTemplate(template, substitutions);

	if (template.includes("{{")) {
		console.warn("Warning: template may contain unreplaced {{placeholders}}");
	}

	fs.writeFileSync(outputPath, template, "utf8");
	console.log(`Wrote ${outputPath} (${mode} mode)`);
	return true;
}

if (import.meta.main) {
	try {
		await generateWranglerConfig();
	} catch (e) {
		console.error("generate-wrangler failed:", e);
		process.exit(1);
	}
}
