import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { PlopTypes } from "@turbo/gen";

export default function generator(plop: PlopTypes.NodePlopAPI): void {
	plop.setHelper("workerNameEnvKey", (name: string) => {
		const kebab = plop.getHelper("kebabCase")(name) as string;
		return `${kebab.replace(/-/g, "_").toUpperCase()}_WORKER_NAME`;
	});

	plop.setGenerator("durable-object", {
		description:
			"Generate a typed Hono Durable Object package with its own package-local Alchemy app.",
		prompts: [
			{
				type: "input",
				name: "name",
				message: "What is the name of the Durable Object (e.g., 'user-session')?",
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
			() => {
				try {
					execSync("bun install", { stdio: "inherit" });
					return "Installed dependencies";
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
