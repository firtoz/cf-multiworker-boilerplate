import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { PlopTypes } from "@turbo/gen";

export default function generator(plop: PlopTypes.NodePlopAPI): void {
	plop.setHelper(
		"workerNameEnvKey",
		(name: string) => {
			const kebab = plop.getHelper("kebabCase")(name) as string;
			return `${kebab.replace(/-/g, "_").toUpperCase()}_WORKER_NAME`;
		},
	);

	plop.setGenerator("durable-object", {
		description:
			"Generate a new Durable Object (wrangler.jsonc.hbs, scripts, turbo). After generation, wire this package into sibling packages' typegen dependsOn and apps/web bindings if other workers need to call it.",
		prompts: [
			{
				type: "input",
				name: "name",
				message:
					"What is the name of the Durable Object (e.g., 'user-session')?",
				validate: (input: string) => {
					if (input.includes(" ")) {
						return "name cannot include spaces";
					}
					if (!input) {
						return "name is required";
					}
					return true;
				},
			},
			{
				type: "input",
				name: "description",
				message: "What is the description of this Durable Object?",
				default: "A new Durable Object implementation",
			},
		],
		actions: [
			{
				type: "addMany",
				destination: "durable-objects/{{ kebabCase name }}/",
				base: "templates/durable-object/",
				templateFiles: "**/*",
				stripExtensions: ["hbs"],
				globOptions: { dot: true },
				verbose: true,
			},
			// Custom action to rename .gitignore.hbs to .gitignore since stripExtensions doesn't work with this dotfile
			(answers, _config, _plopfileApi) => {
				const data = answers as { name: string; description: string };
				const kebabName = plop.getHelper("kebabCase")(data.name);

				const srcPath = path.join("durable-objects", kebabName, ".gitignore.hbs");
				const destPath = path.join("durable-objects", kebabName, ".gitignore");

				try {
					if (fs.existsSync(srcPath)) {
						fs.renameSync(srcPath, destPath);
						return `Renamed .gitignore.hbs to .gitignore for ${kebabName}`;
					}
					return `No .gitignore.hbs file found to rename for ${kebabName}`;
				} catch (error) {
					if (error instanceof Error) {
						return `Failed to rename .gitignore.hbs: ${error.message}`;
					}
					return `Failed to rename .gitignore.hbs: ${error}`;
				}
			},
			(answers, _config, _plopfileApi) => {
				const data = answers as { name: string; description: string };
				const kebab = plop.getHelper("kebabCase")(data.name) as string;
				try {
					execSync(`cd durable-objects/${kebab} && bun run generate-wrangler:local`, {
						stdio: "inherit",
					});
					execSync(
						`cd durable-objects/${kebab} && bunx wrangler types -c wrangler-dev.jsonc`,
						{ stdio: "inherit" },
					);
					return `Generated wrangler-dev.jsonc and worker-configuration.d.ts for ${data.name}`;
				} catch (error) {
					if (error instanceof Error) {
						return `Failed to generate wrangler/types: ${error.message}`;
					}
					return `Failed to generate wrangler/types: ${error}`;
				}
			},
			(answers, _config, _plopfileApi) => {
				const data = answers as { name: string; description: string };
				try {
					execSync("bun install", { stdio: "inherit" });
					return `Installed dependencies for ${data.name} durable object`;
				} catch (error) {
					if (error instanceof Error) {
						return `Failed to install dependencies: ${error.message}`;
					}
					return `Failed to install dependencies: ${error}`;
				}
			},
		],
	});
}
