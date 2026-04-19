/**
 * Single place for production deploy env shape: aligns `setup:prod`, docs, and generate-wrangler remote keys.
 * When adding DEPLOYMENT_KEYS or secrets in wrangler templates, update this module and bootstrap-env-prod prompts.
 */
import fs from "node:fs";
import path from "node:path";
import { findNodeAtLocation, parseTree } from "jsonc-parser";
import { DEPLOYMENT_KEYS, PROD_DEFAULTS } from "./generate-wrangler";

export { DEPLOYMENT_KEYS, PROD_DEFAULTS };

/**
 * Union of `secrets.required` across all `wrangler.jsonc.hbs` under apps/ and durable-objects/.
 */
export function discoverSecretsRequiredFromTemplates(repoRoot: string): string[] {
	const names = new Set<string>();
	for (const base of ["apps", "durable-objects"]) {
		const basePath = path.join(repoRoot, base);
		if (!fs.existsSync(basePath)) {
			continue;
		}
		for (const entry of fs.readdirSync(basePath, { withFileTypes: true })) {
			if (!entry.isDirectory()) {
				continue;
			}
			const hbsPath = path.join(basePath, entry.name, "wrangler.jsonc.hbs");
			if (!fs.existsSync(hbsPath)) {
				continue;
			}
			const content = fs.readFileSync(hbsPath, "utf8");
			const tree = parseTree(content);
			if (!tree) {
				continue;
			}
			const requiredNode = findNodeAtLocation(tree, ["secrets", "required"]);
			if (!requiredNode || requiredNode.type !== "array") {
				continue;
			}
			for (const el of requiredNode.children || []) {
				if (el.type === "string" && typeof el.value === "string") {
					names.add(el.value);
				}
			}
		}
	}
	return Array.from(names).sort();
}
