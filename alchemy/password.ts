/**
 * Required whenever `alchemy.secret()` is used - encrypts values in Alchemy state.
 * Set `ALCHEMY_PASSWORD` in production/CI; local dev uses a documented default.
 *
 * @see https://alchemy.run/concepts/secret/#encryption-password
 */
export const alchemyPassword =
	process.env["ALCHEMY_PASSWORD"] ?? "local-dev-alchemy-password-not-for-production";
