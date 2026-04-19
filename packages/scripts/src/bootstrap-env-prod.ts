#!/usr/bin/env bun
import path from "node:path";
/**
 * Interactive setup for repo-root `.env.production` (live deploy / prod wrangler).
 * See `prod-env-manifest.ts` for key lists; keep prompts aligned with DEPLOYMENT_KEYS and templates.
 */
import { stdin as input } from "node:process";
import readline from "node:readline";
import { AbortPromptError, CancelPromptError, ExitPromptError } from "@inquirer/core";
import { confirm, input as inputPrompt, password, select } from "@inquirer/prompts";
import pc from "picocolors";
import { getRepoRoot } from "./load-env-production";
import {
	CF_WRANGLER_LOGIN_EXPLAINER,
	formatBanner,
	isUnset,
	missingRequiredProdSecrets,
	PROD_SETUP_BANNER,
} from "./utils/env-setup-manifest";
import {
	DEPLOYMENT_KEYS,
	discoverSecretsRequiredFromTemplates,
	PROD_DEFAULTS,
} from "./utils/prod-env-manifest";
import { isWranglerLoggedIn, runWranglerLogin } from "./utils/wrangler-setup-auth";

const root = getRepoRoot();
const dest = path.join(root, ".env.production");
const destLocal = path.join(root, ".env.local");

function parseCfTokenFromEnv(raw: string | undefined): string | null {
	if (raw === undefined || isUnset(raw)) {
		return null;
	}
	return isPlausibleApiToken(raw) ? raw.trim() : null;
}

function parseCfAccountFromEnv(raw: string | undefined): string | null {
	if (raw === undefined || isUnset(raw)) {
		return null;
	}
	const t = raw.trim();
	return isAccountId(t) ? t : null;
}

async function withQuit<T>(run: (ctx: { signal?: AbortSignal }) => Promise<T>): Promise<T> {
	if (!input.isTTY) {
		return run({});
	}
	const ac = new AbortController();
	readline.emitKeypressEvents(input);
	const onKeypress = (_: unknown, key: { name?: string }) => {
		if (key?.name === "q") {
			ac.abort();
		}
	};
	input.prependListener("keypress", onKeypress);
	try {
		return await run({ signal: ac.signal });
	} finally {
		input.removeListener("keypress", onKeypress);
	}
}

function parseArgs(argv: string[]) {
	const args = argv.slice(2);
	return {
		yes: args.includes("--yes") || args.includes("-y"),
		force: args.includes("--force"),
	};
}

function randomSessionSecret(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	let s = "";
	for (const b of bytes) {
		s += String.fromCharCode(b);
	}
	return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function escapeEnvValue(value: string): string {
	if (/[\r\n"#]/.test(value)) {
		return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
	}
	return value;
}

function isAccountId(value: string): boolean {
	return /^[a-f0-9]{32}$/i.test(value.trim());
}

function isPlausibleApiToken(value: string): boolean {
	const v = value.trim();
	return v.length >= 30 && !/\s/.test(v);
}

type ProdAnswers = {
	sessionSecret: string;
	/** Set when present in `.env.production`; `null` means omitted (use `wrangler login` / CI env). */
	cloudflareApiToken: string | null;
	cloudflareAccountId: string | null;
	/** Omitted from file when `null` — empty ROUTES ⇒ workers.dev / defaults in generate-wrangler. */
	routes: string | null;
	routesZoneName: string | null;
	/** Omitted when `null` — substitution uses PROD_DEFAULTS from generate-wrangler. */
	webWorkerName: string | null;
	exampleDoWorkerName: string | null;
	coordinatorDoWorkerName: string | null;
	processorDoWorkerName: string | null;
	/** Declared in wrangler `secrets.required`; value must be set for deploy (omit line only before first value). */
	extraSecrets: Record<string, string | null>;
};

function defaultProdAnswers(): ProdAnswers {
	return {
		sessionSecret: "",
		cloudflareApiToken: null,
		cloudflareAccountId: null,
		routes: null,
		routesZoneName: null,
		webWorkerName: null,
		exampleDoWorkerName: null,
		coordinatorDoWorkerName: null,
		processorDoWorkerName: null,
		extraSecrets: {},
	};
}

function parseOptionalDeploymentString(raw: string | undefined): string | null {
	if (raw === undefined || isUnset(raw)) {
		return null;
	}
	return raw.trim();
}

function parseProdWorkerSlot(raw: string | undefined, templateDefault: string): string | null {
	if (raw === undefined || isUnset(raw)) {
		return null;
	}
	const t = raw.trim();
	if (t === templateDefault) {
		return null;
	}
	return t;
}

function parseExtraSecretFromFile(raw: string | undefined): string | null {
	if (raw === undefined || isUnset(raw)) {
		return null;
	}
	return raw.trim();
}

function deploymentLineValue(a: ProdAnswers, key: (typeof DEPLOYMENT_KEYS)[number]): string | null {
	switch (key) {
		case "ROUTES":
			return a.routes;
		case "ROUTES_ZONE_NAME":
			return a.routesZoneName;
		case "WEB_WORKER_NAME":
			return a.webWorkerName;
		case "EXAMPLE_DO_WORKER_NAME":
			return a.exampleDoWorkerName;
		case "COORDINATOR_DO_WORKER_NAME":
			return a.coordinatorDoWorkerName;
		case "PROCESSOR_DO_WORKER_NAME":
			return a.processorDoWorkerName;
		default:
			return null;
	}
}

/** Loose parse: KEY=value for common prod keys and extras. */
function parseEnvLines(text: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const line of text.split("\n")) {
		const t = line.trim();
		if (t.startsWith("#") || !t) {
			continue;
		}
		const m = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(t);
		if (!m) {
			continue;
		}
		let val = m[2];
		if (val.startsWith('"') && val.endsWith('"')) {
			val = val.slice(1, -1).replaceAll('\\"', '"').replaceAll("\\\\", "\\");
		}
		out[m[1]] = val;
	}
	return out;
}

function prodAnswersFromRecord(r: Record<string, string>, discovered: string[]): ProdAnswers {
	const a = defaultProdAnswers();
	a.sessionSecret = r.SESSION_SECRET ?? "";
	a.cloudflareApiToken = parseCfTokenFromEnv(r.CLOUDFLARE_API_TOKEN);
	a.cloudflareAccountId = parseCfAccountFromEnv(r.CLOUDFLARE_ACCOUNT_ID);
	a.routes = parseOptionalDeploymentString(r.ROUTES);
	a.routesZoneName = parseOptionalDeploymentString(r.ROUTES_ZONE_NAME);
	a.webWorkerName = parseProdWorkerSlot(r.WEB_WORKER_NAME, PROD_DEFAULTS.WEB_WORKER_NAME);
	a.exampleDoWorkerName = parseProdWorkerSlot(
		r.EXAMPLE_DO_WORKER_NAME,
		PROD_DEFAULTS.EXAMPLE_DO_WORKER_NAME,
	);
	a.coordinatorDoWorkerName = parseProdWorkerSlot(
		r.COORDINATOR_DO_WORKER_NAME,
		PROD_DEFAULTS.COORDINATOR_DO_WORKER_NAME,
	);
	a.processorDoWorkerName = parseProdWorkerSlot(
		r.PROCESSOR_DO_WORKER_NAME,
		PROD_DEFAULTS.PROCESSOR_DO_WORKER_NAME,
	);

	const known = new Set([
		"SESSION_SECRET",
		"CLOUDFLARE_API_TOKEN",
		"CLOUDFLARE_ACCOUNT_ID",
		...DEPLOYMENT_KEYS,
	]);
	for (const name of discovered) {
		if (!known.has(name) && r[name] !== undefined) {
			a.extraSecrets[name] = parseExtraSecretFromFile(r[name]);
		}
	}
	return a;
}

function buildProdEnvFile(answers: ProdAnswers): string {
	let out = `# Generated by bun run setup:prod — edit freely. See repository README for env documentation.

SESSION_SECRET=${escapeEnvValue(answers.sessionSecret)}
`;

	if (answers.cloudflareApiToken !== null) {
		out += `CLOUDFLARE_API_TOKEN=${escapeEnvValue(answers.cloudflareApiToken)}\n`;
	}
	if (answers.cloudflareAccountId !== null) {
		out += `CLOUDFLARE_ACCOUNT_ID=${escapeEnvValue(answers.cloudflareAccountId)}\n`;
	}

	out += `
`;

	out += "# Deployment — optional keys omitted below use generate-wrangler / Wrangler defaults.\n";
	for (const key of DEPLOYMENT_KEYS) {
		const val = deploymentLineValue(answers, key);
		if (val !== null && val.trim() !== "") {
			out += `${key}=${escapeEnvValue(val)}\n`;
		}
	}

	const writtenSecrets = new Set(["SESSION_SECRET"]);
	for (const [k, v] of Object.entries(answers.extraSecrets)) {
		if (!writtenSecrets.has(k) && v !== null && v.trim() !== "") {
			out += `\n# Required for wrangler secrets.required\n${k}=${escapeEnvValue(v)}\n`;
			writtenSecrets.add(k);
		}
	}

	return out;
}

async function promptSessionBlock(): Promise<string> {
	const mode = await withQuit((ctx) =>
		select<"generate" | "manual">(
			{
				message: "How do you want to set SESSION_SECRET (web worker cookies / sync-secrets)?",
				choices: [
					{ name: "Generate a random secret (recommended)", value: "generate" },
					{ name: "I'll enter my own", value: "manual" },
				],
				default: "generate",
			},
			ctx,
		),
	);
	if (mode === "manual") {
		return await inputPrompt({
			message: "SESSION_SECRET (min 16 characters)",
			validate: (v) =>
				v.trim().length >= 16 || "Use at least 16 characters, or pick Generate above.",
		});
	}
	const s = randomSessionSecret();
	console.log(pc.dim(`  Generated SESSION_SECRET (${s.length} chars).\n`));
	return s;
}

async function maybePrefillFromLocal(a: ProdAnswers): Promise<void> {
	if (!(await Bun.file(destLocal).exists())) {
		return;
	}
	const go = await withQuit((ctx) =>
		confirm(
			{
				message:
					"Copy overlapping keys from .env.local into this wizard as defaults? (You still confirm each section.)",
				default: false,
			},
			ctx,
		),
	);
	if (!go) {
		return;
	}
	const parsed = parseEnvLines(await Bun.file(destLocal).text());
	if (parsed.SESSION_SECRET && !isUnset(parsed.SESSION_SECRET)) {
		a.sessionSecret = parsed.SESSION_SECRET;
	}
	const tok = parseCfTokenFromEnv(parsed.CLOUDFLARE_API_TOKEN);
	if (tok) {
		a.cloudflareApiToken = tok;
	}
	const acc = parseCfAccountFromEnv(parsed.CLOUDFLARE_ACCOUNT_ID);
	if (acc) {
		a.cloudflareAccountId = acc;
	}
	console.log(pc.dim("  Applied matching keys from .env.local where present.\n"));
}

async function promptCloudflareInteractiveProd(a: ProdAnswers): Promise<void> {
	console.log(
		pc.dim(
			`\n  Cloudflare — API token and account ID in this file are optional.\n  ${CF_WRANGLER_LOGIN_EXPLAINER}\n`,
		),
	);

	if (isWranglerLoggedIn()) {
		console.log(pc.green("  Wrangler CLI is already authenticated (`wrangler whoami` OK).\n"));
	} else {
		console.log(
			pc.yellow("  Wrangler is not authenticated yet (`wrangler whoami` did not succeed).\n"),
		);
		const runLogin = await withQuit((ctx) =>
			confirm(
				{
					message: "Run `bunx wrangler login` now? (Opens a browser)",
					default: true,
				},
				ctx,
			),
		);
		if (runLogin) {
			console.log(pc.dim("  Running wrangler login…\n"));
			const ok = await runWranglerLogin();
			if (ok && isWranglerLoggedIn()) {
				console.log(pc.green("  Login successful.\n"));
			} else {
				console.log(
					pc.yellow("  Login may be incomplete — run `bunx wrangler login` yourself when ready.\n"),
				);
			}
		}
	}

	const hadAnyCf = a.cloudflareApiToken !== null || a.cloudflareAccountId !== null;

	const addTokens = await withQuit((ctx) =>
		confirm(
			{
				message:
					"Store CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in .env.production? (Optional — for CI; skip to use OAuth / `wrangler login` for local deploys.)",
				default: hadAnyCf,
			},
			ctx,
		),
	);

	if (!addTokens) {
		if (hadAnyCf) {
			console.log(pc.dim("  Kept existing CLOUDFLARE_* values in this file.\n"));
			return;
		}
		a.cloudflareApiToken = null;
		a.cloudflareAccountId = null;
		console.log(
			pc.dim("  Omitted CLOUDFLARE_* — use `bunx wrangler login` locally, or add vars for CI.\n"),
		);
		return;
	}

	console.log(
		pc.dim("  Press Enter to skip a field — keeps the current value or leaves it omitted.\n"),
	);

	const prevToken = a.cloudflareApiToken;
	const prevAccountId = a.cloudflareAccountId;

	const t = await password({
		message: "CLOUDFLARE_API_TOKEN (Enter to skip)",
		mask: "*",
		validate: (v) => {
			if (isUnset(v)) {
				return true;
			}
			if (isPlausibleApiToken(v)) {
				return true;
			}
			return "30+ characters, no spaces — or Enter to skip.";
		},
	});
	if (isUnset(t)) {
		a.cloudflareApiToken = prevToken;
	} else {
		a.cloudflareApiToken = t.trim();
	}

	const id = await inputPrompt({
		message: "CLOUDFLARE_ACCOUNT_ID (32 hex, or empty to skip)",
		default: prevAccountId ?? "",
		validate: (v) => {
			if (v.trim() === "") {
				return true;
			}
			return isAccountId(v) || "Exactly 32 hex characters — or empty to skip.";
		},
	});
	const idTrim = id.trim();
	if (idTrim === "") {
		a.cloudflareAccountId = prevAccountId;
	} else {
		a.cloudflareAccountId = idTrim;
	}
}

async function interactive(seed?: ProdAnswers): Promise<ProdAnswers> {
	const discovered = discoverSecretsRequiredFromTemplates(root);
	const a = seed ?? defaultProdAnswers();

	console.log();
	console.log(pc.bold("  Production env (.env.production)"));
	console.log(pc.dim("  Used for deploy:execute, sync-secrets, generate-wrangler --mode=remote."));
	console.log(pc.dim(formatBanner(PROD_SETUP_BANNER)));
	console.log(pc.dim("  At menus: q = quit · Esc = cancel.\n"));

	await maybePrefillFromLocal(a);

	if (a.sessionSecret.trim()) {
		const reuse = await withQuit((ctx) =>
			confirm(
				{
					message: `Keep existing SESSION_SECRET (${a.sessionSecret.slice(0, 4)}…)?`,
					default: true,
				},
				ctx,
			),
		);
		if (!reuse) {
			a.sessionSecret = await promptSessionBlock();
		}
	} else {
		a.sessionSecret = await promptSessionBlock();
	}

	await promptCloudflareInteractiveProd(a);

	const routesRaw = await inputPrompt({
		message:
			"ROUTES (optional — custom domains; leave empty to omit from file and use workers.dev)",
		default: a.routes ?? "",
	});
	a.routes = routesRaw.trim() === "" ? null : routesRaw.trim();

	const zoneRaw = await inputPrompt({
		message: "ROUTES_ZONE_NAME (optional — leave empty to omit)",
		default: a.routesZoneName ?? "",
	});
	a.routesZoneName = zoneRaw.trim() === "" ? null : zoneRaw.trim();

	console.log(
		pc.dim(
			"\n  Worker script names (optional — Enter template default to omit from file; generate-wrangler fills defaults).\n",
		),
	);

	const wWeb = await inputPrompt({
		message: `WEB_WORKER_NAME (default ${PROD_DEFAULTS.WEB_WORKER_NAME})`,
		default: a.webWorkerName ?? PROD_DEFAULTS.WEB_WORKER_NAME,
	});
	a.webWorkerName =
		wWeb.trim() === "" || wWeb.trim() === PROD_DEFAULTS.WEB_WORKER_NAME ? null : wWeb.trim();

	const wEx = await inputPrompt({
		message: `EXAMPLE_DO_WORKER_NAME (default ${PROD_DEFAULTS.EXAMPLE_DO_WORKER_NAME})`,
		default: a.exampleDoWorkerName ?? PROD_DEFAULTS.EXAMPLE_DO_WORKER_NAME,
	});
	a.exampleDoWorkerName =
		wEx.trim() === "" || wEx.trim() === PROD_DEFAULTS.EXAMPLE_DO_WORKER_NAME ? null : wEx.trim();

	const wCo = await inputPrompt({
		message: `COORDINATOR_DO_WORKER_NAME (default ${PROD_DEFAULTS.COORDINATOR_DO_WORKER_NAME})`,
		default: a.coordinatorDoWorkerName ?? PROD_DEFAULTS.COORDINATOR_DO_WORKER_NAME,
	});
	a.coordinatorDoWorkerName =
		wCo.trim() === "" || wCo.trim() === PROD_DEFAULTS.COORDINATOR_DO_WORKER_NAME
			? null
			: wCo.trim();

	const wPr = await inputPrompt({
		message: `PROCESSOR_DO_WORKER_NAME (default ${PROD_DEFAULTS.PROCESSOR_DO_WORKER_NAME})`,
		default: a.processorDoWorkerName ?? PROD_DEFAULTS.PROCESSOR_DO_WORKER_NAME,
	});
	a.processorDoWorkerName =
		wPr.trim() === "" || wPr.trim() === PROD_DEFAULTS.PROCESSOR_DO_WORKER_NAME ? null : wPr.trim();

	const known = new Set([
		"SESSION_SECRET",
		"CLOUDFLARE_API_TOKEN",
		"CLOUDFLARE_ACCOUNT_ID",
		...DEPLOYMENT_KEYS,
	]);
	for (const name of discovered) {
		if (known.has(name)) {
			continue;
		}
		const val = await inputPrompt({
			message: `${name} — required (wrangler secrets.required); value is synced to Cloudflare`,
			default: a.extraSecrets[name] ?? "",
			validate: (v) =>
				(v.trim().length > 0 && !isUnset(v.trim())) || "Required — enter a real secret value",
		});
		a.extraSecrets[name] = val.trim();
	}

	return a;
}

async function defaultsNonInteractive(): Promise<ProdAnswers> {
	const a = defaultProdAnswers();
	a.sessionSecret = randomSessionSecret();
	a.cloudflareApiToken = parseCfTokenFromEnv(process.env.SETUP_CLOUDFLARE_API_TOKEN);
	a.cloudflareAccountId = parseCfAccountFromEnv(process.env.SETUP_CLOUDFLARE_ACCOUNT_ID);
	a.routes = parseOptionalDeploymentString(process.env.SETUP_ROUTES);
	a.routesZoneName = parseOptionalDeploymentString(process.env.SETUP_ROUTES_ZONE_NAME);
	a.webWorkerName = parseProdWorkerSlot(
		process.env.SETUP_WEB_WORKER_NAME,
		PROD_DEFAULTS.WEB_WORKER_NAME,
	);
	a.exampleDoWorkerName = parseProdWorkerSlot(
		process.env.SETUP_EXAMPLE_DO_WORKER_NAME,
		PROD_DEFAULTS.EXAMPLE_DO_WORKER_NAME,
	);
	a.coordinatorDoWorkerName = parseProdWorkerSlot(
		process.env.SETUP_COORDINATOR_DO_WORKER_NAME,
		PROD_DEFAULTS.COORDINATOR_DO_WORKER_NAME,
	);
	a.processorDoWorkerName = parseProdWorkerSlot(
		process.env.SETUP_PROCESSOR_DO_WORKER_NAME,
		PROD_DEFAULTS.PROCESSOR_DO_WORKER_NAME,
	);

	const discovered = discoverSecretsRequiredFromTemplates(root);
	const known = new Set([
		"SESSION_SECRET",
		"CLOUDFLARE_API_TOKEN",
		"CLOUDFLARE_ACCOUNT_ID",
		...DEPLOYMENT_KEYS,
	]);
	for (const name of discovered) {
		if (!known.has(name)) {
			const v = process.env[`SETUP_${name}`]?.trim();
			if (!v || isUnset(v)) {
				console.error(
					pc.red(
						`Non-interactive setup: set SETUP_${name} to a real secret (required by wrangler templates).`,
					),
				);
				process.exit(1);
			}
			a.extraSecrets[name] = v;
		}
	}
	return a;
}

function maskSecret(s: string, visibleEnd = 4): string {
	const t = s.trim();
	if (t.length === 0) {
		return "(empty)";
	}
	if (t.length <= visibleEnd + 4) {
		return "•".repeat(Math.min(12, t.length));
	}
	return `${t.slice(0, 4)}…${t.slice(-visibleEnd)} (${t.length} chars)`;
}

function printSummary(a: ProdAnswers, title = "Current .env.production") {
	const discovered = discoverSecretsRequiredFromTemplates(root);
	const known = new Set([
		"SESSION_SECRET",
		"CLOUDFLARE_API_TOKEN",
		"CLOUDFLARE_ACCOUNT_ID",
		...DEPLOYMENT_KEYS,
	]);
	const requiredExtraNames = discovered.filter((n) => !known.has(n));

	console.log();
	console.log(pc.bold(`  ${title}`));
	console.log();
	console.log(pc.bold("  Required"));
	console.log(
		`    ${pc.dim("SESSION_SECRET")}  ${a.sessionSecret.trim() ? maskSecret(a.sessionSecret) : pc.red("missing")}`,
	);
	for (const name of requiredExtraNames) {
		const v = a.extraSecrets[name];
		const ok = v !== null && v !== undefined && !isUnset(v);
		console.log(
			`    ${pc.dim(name)}  ${ok ? maskSecret(v) : pc.red("missing — required for deploy")}`,
		);
	}
	console.log();
	console.log(pc.bold("  Optional (OK if omitted)"));
	console.log(
		`    ${pc.dim("CLOUDFLARE_*")}  ${
			a.cloudflareApiToken === null && a.cloudflareAccountId === null
				? pc.dim("not in file — fine if `bunx wrangler login`")
				: [
						a.cloudflareApiToken === null ? "token omitted" : "token set",
						a.cloudflareAccountId === null ? "account omitted" : "account set",
					].join(", ")
		}`,
	);
	const routesLine =
		a.routes || a.routesZoneName
			? `${a.routes ? "ROUTES" : ""}${a.routes && a.routesZoneName ? " · " : ""}${a.routesZoneName ? "ROUTES_ZONE" : ""}`
			: pc.dim("not in file (workers.dev)");
	console.log(`    ${pc.dim("Routes")}        ${routesLine}`);
	const wLabel = (slot: string | null, def: string) =>
		slot === null ? pc.dim(`default (${def})`) : slot;
	console.log(
		`    ${pc.dim("Workers")}       ${wLabel(a.webWorkerName, PROD_DEFAULTS.WEB_WORKER_NAME)}, ${wLabel(a.exampleDoWorkerName, PROD_DEFAULTS.EXAMPLE_DO_WORKER_NAME)}, …`,
	);
	console.log();
}

async function interactiveUpdateExisting(): Promise<void> {
	const raw = parseEnvLines(await Bun.file(dest).text());
	const discovered = discoverSecretsRequiredFromTemplates(root);
	let answers = prodAnswersFromRecord(raw, discovered);

	console.log(pc.dim("  At menus: q = quit · Esc = cancel.\n"));
	console.log(pc.dim(formatBanner(PROD_SETUP_BANNER)));
	console.log();

	for (;;) {
		printSummary(answers);

		const action = await withQuit((ctx) =>
			select<"done" | "session" | "cloudflare" | "deployment" | "full">(
				{
					message: "What do you want to change?",
					choices: [
						{ name: "Nothing — exit", value: "done" },
						{ name: "SESSION_SECRET", value: "session" },
						{ name: "Cloudflare token & account ID", value: "cloudflare" },
						{ name: "ROUTES, zone, and worker names", value: "deployment" },
						{ name: "Re-run full wizard", value: "full" },
					],
					default: "done",
				},
				ctx,
			),
		);

		if (action === "done") {
			console.log(pc.dim("No changes this run."));
			return;
		}

		if (action === "full") {
			answers = await interactive(defaultProdAnswers());
			await writeDest(answers);
			return;
		}

		if (action === "session") {
			answers.sessionSecret = await promptSessionBlock();
			await writeDest(answers);
			continue;
		}

		if (action === "cloudflare") {
			await promptCloudflareInteractiveProd(answers);
			await writeDest(answers);
			continue;
		}

		if (action === "deployment") {
			const r0 = await inputPrompt({
				message: "ROUTES (empty to omit)",
				default: answers.routes ?? "",
			});
			answers.routes = r0.trim() === "" ? null : r0.trim();
			const z0 = await inputPrompt({
				message: "ROUTES_ZONE_NAME (empty to omit)",
				default: answers.routesZoneName ?? "",
			});
			answers.routesZoneName = z0.trim() === "" ? null : z0.trim();
			const ww = await inputPrompt({
				message: `WEB_WORKER_NAME (empty or default ${PROD_DEFAULTS.WEB_WORKER_NAME} to omit)`,
				default: answers.webWorkerName ?? PROD_DEFAULTS.WEB_WORKER_NAME,
			});
			answers.webWorkerName =
				ww.trim() === "" || ww.trim() === PROD_DEFAULTS.WEB_WORKER_NAME ? null : ww.trim();
			const we = await inputPrompt({
				message: `EXAMPLE_DO_WORKER_NAME (empty or default ${PROD_DEFAULTS.EXAMPLE_DO_WORKER_NAME} to omit)`,
				default: answers.exampleDoWorkerName ?? PROD_DEFAULTS.EXAMPLE_DO_WORKER_NAME,
			});
			answers.exampleDoWorkerName =
				we.trim() === "" || we.trim() === PROD_DEFAULTS.EXAMPLE_DO_WORKER_NAME ? null : we.trim();
			const wc = await inputPrompt({
				message: `COORDINATOR_DO_WORKER_NAME (empty or default ${PROD_DEFAULTS.COORDINATOR_DO_WORKER_NAME} to omit)`,
				default: answers.coordinatorDoWorkerName ?? PROD_DEFAULTS.COORDINATOR_DO_WORKER_NAME,
			});
			answers.coordinatorDoWorkerName =
				wc.trim() === "" || wc.trim() === PROD_DEFAULTS.COORDINATOR_DO_WORKER_NAME
					? null
					: wc.trim();
			const wp = await inputPrompt({
				message: `PROCESSOR_DO_WORKER_NAME (empty or default ${PROD_DEFAULTS.PROCESSOR_DO_WORKER_NAME} to omit)`,
				default: answers.processorDoWorkerName ?? PROD_DEFAULTS.PROCESSOR_DO_WORKER_NAME,
			});
			answers.processorDoWorkerName =
				wp.trim() === "" || wp.trim() === PROD_DEFAULTS.PROCESSOR_DO_WORKER_NAME ? null : wp.trim();
			await writeDest(answers);
		}
	}
}

function afterWriteHints(a: ProdAnswers): void {
	if (a.cloudflareApiToken === null && a.cloudflareAccountId === null) {
		console.log(pc.dim(`Optional Cloudflare: ${CF_WRANGLER_LOGIN_EXPLAINER}`));
	} else if (a.cloudflareApiToken === null || a.cloudflareAccountId === null) {
		console.log(
			pc.dim(
				"Cloudflare: you only set one of token/account — add both for API-token deploys, or remove both and use `bunx wrangler login`.",
			),
		);
	}
	console.log(
		pc.dim(
			"Next: `bun run check-prod-env` then `bun run deploy` (dry-run) or `bun run deploy:execute`.",
		),
	);
}

async function writeDest(answers: ProdAnswers): Promise<void> {
	if (!answers.sessionSecret.trim()) {
		answers.sessionSecret = randomSessionSecret();
		console.log(pc.dim("SESSION_SECRET was empty — generated one.\n"));
	}
	const discovered = discoverSecretsRequiredFromTemplates(root);
	const missingSecrets = missingRequiredProdSecrets(answers, discovered);
	if (missingSecrets.length > 0) {
		console.error(
			pc.red(
				`  Cannot write .env.production: missing required value(s) for: ${missingSecrets.join(", ")}`,
			),
		);
		console.error(
			pc.dim(
				"  These names come from wrangler `secrets.required` and must be set for sync-secrets / deploy.",
			),
		);
		process.exit(1);
	}
	await Bun.write(dest, buildProdEnvFile(answers));
	console.log();
	console.log(pc.green(`Wrote ${dest}`));
	afterWriteHints(answers);
}

async function main(): Promise<void> {
	const { yes, force } = parseArgs(process.argv);
	const nonInteractive = yes || !input.isTTY;

	const destExists = await Bun.file(dest).exists();
	const discovered = discoverSecretsRequiredFromTemplates(root);

	if (destExists && !force && !nonInteractive) {
		await interactiveUpdateExisting();
		return;
	}

	if (destExists && !force && nonInteractive) {
		console.log(pc.yellow(".env.production already exists — skipped (non-interactive)."));
		console.log(pc.dim("  bun run setup:prod          # review / update interactively"));
		console.log(pc.dim("  bun run setup:prod --force  # replace the whole file"));
		process.exit(0);
	}

	if (destExists && force && !nonInteractive) {
		const ok = await withQuit((ctx) =>
			confirm(
				{
					message: pc.yellow("Overwrite existing .env.production with a new full setup?"),
					default: false,
				},
				ctx,
			),
		);
		if (!ok) {
			console.log(pc.dim("Cancelled."));
			process.exit(0);
		}
	}

	let answers: ProdAnswers;
	if (nonInteractive) {
		answers = await defaultsNonInteractive();
	} else {
		const seed =
			destExists && force
				? prodAnswersFromRecord(parseEnvLines(await Bun.file(dest).text()), discovered)
				: undefined;
		answers = await interactive(seed);
	}

	await writeDest(answers);
}

try {
	await main();
} catch (e) {
	if (
		e instanceof ExitPromptError ||
		e instanceof CancelPromptError ||
		e instanceof AbortPromptError
	) {
		console.log(pc.dim("\nCancelled."));
		process.exit(0);
	}
	throw e;
}
