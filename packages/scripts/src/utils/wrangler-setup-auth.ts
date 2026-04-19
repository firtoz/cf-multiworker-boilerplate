/**
 * Shared helpers for setup wizards: detect Wrangler OAuth login vs API token in env files.
 */
import { execFileSync, spawn } from "node:child_process";

/** True if `wrangler whoami` exits 0 (OAuth or token in env Wrangler can use). */
export function isWranglerLoggedIn(): boolean {
	try {
		execFileSync("bunx", ["wrangler", "whoami"], {
			stdio: "ignore",
			timeout: 25_000,
			env: process.env,
		});
		return true;
	} catch {
		return false;
	}
}

/** Run interactive OAuth login (browser). Resolves true if process exits 0. */
export function runWranglerLogin(): Promise<boolean> {
	return new Promise((resolve) => {
		const child = spawn("bunx", ["wrangler", "login"], {
			stdio: "inherit",
			env: process.env,
		});
		child.on("error", () => resolve(false));
		child.on("close", (code) => resolve(code === 0));
	});
}
