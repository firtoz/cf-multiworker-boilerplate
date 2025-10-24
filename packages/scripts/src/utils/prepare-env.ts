import * as fs from "node:fs";
import path from "node:path";

/**
 * Ensures a .env file exists in the target directory.
 * If it doesn't exist, copies from .env.example.
 *
 * @param targetDir - The directory where the .env file should exist
 * @returns true if .env was created, false if it already existed
 * @throws Error if .env.example doesn't exist
 */
export function prepareEnvFile(targetDir: string): boolean {
	const envPath = path.join(targetDir, ".env");

	if (fs.existsSync(envPath)) {
		return false;
	}

	const exampleEnvPath = path.join(targetDir, ".env.example");

	if (!fs.existsSync(exampleEnvPath)) {
		throw new Error(`No .env.example file found in ${targetDir}.`);
	}

	fs.cpSync(exampleEnvPath, envPath);
	return true;
}
