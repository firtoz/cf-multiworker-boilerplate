import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { cancel, confirm, intro, isCancel, note, outro, password, select } from "@clack/prompts";

const root = resolve(import.meta.dir, "../..");
const argv = process.argv;
const isProd = argv.includes("--prod");
const flagEdit = argv.includes("--edit");
const forceNonInteractive = argv.includes("--yes") || argv.includes("-y");
const file = join(root, isProd ? ".env.production" : ".env.local");

type SecretKey = "SESSION_SECRET" | "ALCHEMY_PASSWORD";
const ALL_KEYS: readonly SecretKey[] = ["SESSION_SECRET", "ALCHEMY_PASSWORD"];

/** Shown in prompts and notes — not the raw var name. */
const KEY_COPY: Readonly<Record<SecretKey, { title: string; line: string }>> = {
	SESSION_SECRET: {
		title: "Session secret",
		line: "Signs web sessions and cookies",
	},
	ALCHEMY_PASSWORD: {
		title: "Alchemy password",
		line: "Encrypts Alchemy state on disk / in CI",
	},
};

function keyNoteBody(keys: readonly SecretKey[], mode: "present" | "missing") {
	return keys
		.map(
			(k) =>
				`• ${KEY_COPY[k].title}  \`${k}\`` +
				(mode === "missing" ? "\n  not in this file yet" : `\n  ${KEY_COPY[k].line}`),
		)
		.join("\n\n");
}

/** After rotating ALCHEMY_PASSWORD, existing .alchemy/ was encrypted with the old key — deploy/dev decrypt fails until state is removed or the old password is restored. */
function alchemyPasswordStateHint() {
	return " If .alchemy/ was created with a previous password, run `rm -rf .alchemy` at the repository root (then deploy or dev) or you may see Alchemy AES decrypt / authenticate errors.";
}

function outroForUpdatedKeyNames(keyList: readonly SecretKey[]) {
	if (keyList.length === 0) {
		return "No changes.";
	}
	const human = keyList.map((k) => KEY_COPY[k].title);
	let msg = `Updated ${human.join(" · ")}  (${keyList.join(", ")}  →  ${basename(file)})`;
	if (keyList.includes("ALCHEMY_PASSWORD")) {
		msg += alchemyPasswordStateHint();
	}
	return msg;
}

/** Real terminal: menus. CI, pipes, cloud agent, `--yes` use non-interactive path. */
function useInteractivePrompt() {
	if (forceNonInteractive) {
		return false;
	}
	if (process.env["CI"] === "true") {
		return false;
	}
	return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function gen() {
	return randomBytes(32).toString("base64url");
}

function hasValue(envText: string, key: string) {
	return new RegExp(`^\\s*${key}\\s*=\\s*\\S`, "m").test(envText);
}

function buildFileContent(existing: string, toAdd: string[]) {
	let body = existing;
	if (body) {
		if (!body.endsWith("\n")) {
			body += "\n";
		}
		body += `\n# --- ${isProd ? "bun run setup:prod" : "bun run setup"} — added keys\n`;
	} else {
		body = `# See repo-root .env.example. This file is gitignored — do not commit.
# Appended: ${isProd ? "bun run setup:prod" : "bun run setup"}

`;
	}
	return `${body}${toAdd.join("\n")}\n`;
}

/** Replace or append KEY=value (single-line values only; no newlines in value). */
function upsertEnvLines(text: string, pairs: Readonly<Record<string, string>>) {
	let out = text;
	for (const [key, value] of Object.entries(pairs)) {
		if (value.includes("\n") || value.includes("\r")) {
			throw new Error(`Refusing to write ${key}: value must be a single line.`);
		}
		const line = `${key}=${value}`;
		const re = new RegExp(`^\\s*${key}\\s*=\\s*[^\\n]*$`, "m");
		if (re.test(out)) {
			out = out.replace(re, line);
		} else {
			if (out && !out.endsWith("\n")) {
				out += "\n";
			}
			out += `${line}\n`;
		}
	}
	return out;
}

async function readSecretLine(k: SecretKey) {
	const v = await password({
		message: `${KEY_COPY[k].title}  (${k})`,
		mask: "*",
		validate: (s) => (s?.trim() ? undefined : "Required"),
	});
	if (isCancel(v)) {
		return null;
	}
	return v.trim();
}

async function collectValuesManual(keys: readonly SecretKey[]) {
	const out: Record<string, string> = {};
	for (const k of keys) {
		const v = await readSecretLine(k);
		if (v === null) {
			return null;
		}
		out[k] = v;
	}
	return out;
}

/**
 * Ask per key: keep, random, or type (if `allowKeep`), else random or type.
 * @returns `null` if cancelled; empty object if every key was left as-is.
 */
async function collectPerKeyUpdates(
	keys: readonly SecretKey[],
	{ allowKeep }: { allowKeep: boolean },
): Promise<Partial<Record<SecretKey, string>> | null> {
	const out: Partial<Record<SecretKey, string>> = {};
	for (const k of keys) {
		const options = allowKeep
			? [
					{ value: "keep" as const, label: "Leave current" },
					{ value: "random" as const, label: "New random" },
					{ value: "manual" as const, label: "Type new (masked)" },
				]
			: [
					{ value: "random" as const, label: "Generate random" },
					{ value: "manual" as const, label: "Type my own (masked)" },
				];
		const head = allowKeep ? `Update ${KEY_COPY[k].title}` : `Set ${KEY_COPY[k].title}`;
		const choice = await select({
			message: `${head}  (${k})`,
			options,
		});
		if (isCancel(choice) || !choice) {
			return null;
		}
		if (choice === "keep") {
			continue;
		}
		if (choice === "random") {
			out[k] = gen();
		} else {
			const v = await readSecretLine(k);
			if (v === null) {
				return null;
			}
			out[k] = v;
		}
	}
	return out;
}

/**
 * Fills the given keys: interactive → per-key random / manual. Non-interactive → random only.
 * @returns `null` if user cancelled
 */
async function chooseValuesForKeys(
	keys: readonly SecretKey[],
	interactive: boolean,
): Promise<Record<string, string> | null> {
	if (keys.length === 0) {
		return {};
	}
	if (!interactive) {
		return Object.fromEntries(keys.map((k) => [k, gen()])) as Record<string, string>;
	}
	const partial = await collectPerKeyUpdates(keys, { allowKeep: false });
	if (partial === null) {
		return null;
	}
	return partial as Record<string, string>;
}

async function main() {
	const body = existsSync(file) ? readFileSync(file, "utf8") : "";
	const missing = ALL_KEYS.filter((k) => !hasValue(body, k));
	const interactive = useInteractivePrompt();

	/* ----- partial / full missing → append (or new file) ----- */
	if (missing.length > 0) {
		if (interactive) {
			intro("cf-multiworker — environment variables");
			note(keyNoteBody(missing, "missing"), basename(file));
			const ok = await confirm({
				message: "Add values for the missing key(s) now?",
				initialValue: true,
			});
			if (isCancel(ok)) {
				cancel("Setup cancelled.");
				process.exit(0);
			}
			if (!ok) {
				outro("No changes. Add keys by hand (see .env.example) or run this command again.");
				process.exit(1);
			}
		}
		const values = await chooseValuesForKeys(missing, interactive);
		if (values === null) {
			cancel("Setup cancelled.");
			process.exit(0);
		}
		const toAdd = missing.map((k) => {
			const v = values[k];
			if (v == null) {
				throw new Error(`[setup] internal: missing value for ${k}`);
			}
			return `${k}=${v}`;
		});
		const out = buildFileContent(body, toAdd);
		writeFileSync(file, out, "utf8");
		let successMsg = `Wrote ${toAdd.length} key(s) in ${file}. For production, store secrets in your real secret store or CI as needed.`;
		if (missing.includes("ALCHEMY_PASSWORD")) {
			successMsg += alchemyPasswordStateHint();
		}
		if (interactive) {
			outro(successMsg);
		} else {
			console.log(`[setup] ${successMsg}`);
		}
		return;
	}

	/* ----- all keys present → update or nothing ----- */
	if (!interactive) {
		if (flagEdit && forceNonInteractive) {
			const fresh = { SESSION_SECRET: gen(), ALCHEMY_PASSWORD: gen() } as const;
			const out = upsertEnvLines(body, fresh);
			writeFileSync(file, out, "utf8");
			console.log(
				`[setup] --edit --yes: rotated ${ALL_KEYS.join(" and ")} with new random values in ${file}.${alchemyPasswordStateHint()}`,
			);
			return;
		}
		if (flagEdit && !forceNonInteractive) {
			console.error(
				"[setup] --edit in non-TTY needs --yes to rotate, or run in a real terminal for menus.",
			);
			process.exit(1);
		}
		const lines: string[] = [
			`[setup] ${file}`,
			`[setup]   All required keys are present. Per-key menus: run in a TTY. One-shot (both random, non-interactive):`,
		];
		for (const k of ALL_KEYS) {
			lines.push(`[setup]   • ${KEY_COPY[k].title}  (${k})`);
		}
		lines.push(`[setup]   bun run setup -- --edit --yes`);
		for (const line of lines) {
			console.log(line);
		}
		return;
	}

	/* interactive + all present */
	if (!flagEdit) {
		intro("cf-multiworker — local secrets");
		note(keyNoteBody(ALL_KEYS, "present"), basename(file));
		const action = await select({
			message: "What would you like to do next?",
			options: [
				{ value: "keep" as const, label: "Done — make no changes" },
				{ value: "perKey" as const, label: "Go through each key (leave, random, or type)" },
				{ value: "random" as const, label: "Regenerate both (random)" },
				{ value: "manual" as const, label: "Type new values for both (masked)" },
			],
		});
		if (isCancel(action) || !action || action === "keep") {
			if (action === "keep") {
				outro("No changes.");
			} else {
				cancel("Setup cancelled.");
			}
			process.exit(0);
		}
		if (action === "perKey") {
			const updates = await collectPerKeyUpdates(ALL_KEYS, { allowKeep: true });
			if (updates === null) {
				cancel("Setup cancelled.");
				process.exit(0);
			}
			if (Object.keys(updates).length === 0) {
				outro("No changes.");
				return;
			}
			const out = upsertEnvLines(body, updates);
			writeFileSync(file, out, "utf8");
			outro(outroForUpdatedKeyNames(Object.keys(updates) as SecretKey[]));
			return;
		}
		if (action === "random") {
			const out = upsertEnvLines(
				body,
				Object.fromEntries(ALL_KEYS.map((k) => [k, gen()])) as Record<string, string>,
			);
			writeFileSync(file, out, "utf8");
			outro(
				`Regenerated both secrets  (${ALL_KEYS.join(", ")}  →  ${basename(file)}) with new random values`,
			);
			return;
		}
		const values = await collectValuesManual(ALL_KEYS);
		if (values === null) {
			cancel("Setup cancelled.");
			process.exit(0);
		}
		const out = upsertEnvLines(body, values);
		writeFileSync(file, out, "utf8");
		outro(outroForUpdatedKeyNames(ALL_KEYS));
		return;
	}

	/* --edit: go straight to per-key (leave / random / type) */
	intro("cf-multiworker — update existing secrets");
	note(keyNoteBody(ALL_KEYS, "present"), basename(file));
	const updates = await collectPerKeyUpdates(ALL_KEYS, { allowKeep: true });
	if (updates === null) {
		cancel("Setup cancelled.");
		process.exit(0);
	}
	if (Object.keys(updates).length === 0) {
		outro("No changes.");
		return;
	}
	const out = upsertEnvLines(body, updates);
	writeFileSync(file, out, "utf8");
	outro(outroForUpdatedKeyNames(Object.keys(updates) as SecretKey[]));
}

await main();
