import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { PlopTypes } from "@turbo/gen";

export default function generator(plop: PlopTypes.NodePlopAPI): void {
	plop.setGenerator("durable-object", {
		description:
			"Generate a new Durable Object with all necessary configuration files",
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
				try {
					execSync(
						`cd durable-objects/${plop.getHelper("kebabCase")(data.name)} && bunx wrangler types`,
						{ stdio: "inherit" },
					);
					return `Generated TypeScript types for ${data.name}`;
				} catch (error) {
					if (error instanceof Error) {
						return `Failed to generate types: ${error.message}`;
					}
					return `Failed to generate types: ${error}`;
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
