/**
 * Required whenever `alchemy()` uses `{ password: … }` — encrypts `alchemy.secret()` in Alchemy state.
 * Set `ALCHEMY_PASSWORD` in repo-root **`.env.local`** (dev) or **`.env.production`** (deploy / CI), or your secret store in CI.
 * Package scripts keep those state files separate with `--stage local` and `--stage prod`, so the passwords do not need to match.
 *
 * @see https://alchemy.run/concepts/secret/#encryption-password
 */

/** Set by this repo’s package.json (deploy/dev/destroy scripts). Alchemy’s worker has no `deploy` in argv. */
const MODE = process.env["CF_STARTER_ALCHEMY_MODE"] as "deploy" | "destroy" | "dev" | undefined;

function missingAlchemyPasswordMessage() {
	if (MODE === "deploy") {
		return (
			"ALCHEMY_PASSWORD is not set. For deploy, run `bun run setup:prod` at the repository root to seed " +
			"repo-root .env.production, or add ALCHEMY_PASSWORD there / in CI. Deploy uses: " +
			"bun --env-file ../../.env.production alchemy deploy …"
		);
	}
	if (MODE === "destroy") {
		return (
			"ALCHEMY_PASSWORD is not set. For destroy, set it the same as deploy: repo-root .env.production (e.g. `bun run setup:prod`) " +
			"or export it. This repo uses: bun --env-file ../../.env.production alchemy destroy …"
		);
	}
	if (MODE === "dev") {
		return (
			"ALCHEMY_PASSWORD is not set. For local dev, run `bun run setup` to seed .env.local, or export ALCHEMY_PASSWORD. " +
			"Dev uses: bun --env-file ../../.env.local alchemy dev …"
		);
	}

	const argv = process.argv;
	if (argv.includes("destroy")) {
		return (
			"ALCHEMY_PASSWORD is not set. For alchemy destroy, set it in repo-root .env.production (bun run setup:prod) " +
			"or in the environment. This repo’s destroy script uses: bun --env-file ../../.env.production alchemy destroy …"
		);
	}
	if (argv.includes("deploy")) {
		return (
			"ALCHEMY_PASSWORD is not set. For alchemy deploy, set it in repo-root .env.production (bun run setup:prod) " +
			"or in the environment. This repo’s deploy script uses: bun --env-file ../../.env.production alchemy deploy …"
		);
	}
	if (argv.includes("dev")) {
		return (
			"ALCHEMY_PASSWORD is not set. For alchemy dev, set it in repo-root .env.local (bun run setup) or the environment. " +
			"This repo’s dev script uses: bun --env-file ../../.env.local alchemy dev …"
		);
	}
	return (
		"ALCHEMY_PASSWORD is not set. Dev: .env.local (bun run setup). Deploy/destroy: .env.production (bun run setup:prod) or " +
		"export the variable (CI). If you use this package’s alchemy * npm scripts, they set CF_STARTER_ALCHEMY_MODE for clearer errors."
	);
}

const raw = process.env["ALCHEMY_PASSWORD"];
if (raw == null || raw === "") {
	throw new Error(missingAlchemyPasswordMessage());
}
export const alchemyPassword: string = raw;
