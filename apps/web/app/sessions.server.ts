import { env } from "cloudflare:workers";
import { createCookieSessionStorage, type Session } from "react-router";

export type AppSessionData = {
	userId: string;
};

export type SessionResult = Session<AppSessionData>;

const maxAge = 60 * 60 * 24 * 30; // 30 days

function getSessionStorage() {
	if (!env.SESSION_SECRET) {
		throw new Error("SESSION_SECRET is not defined");
	}

	return createCookieSessionStorage<AppSessionData>({
		cookie: {
			httpOnly: true,
			name: "cf-app-session",
			path: "/",
			sameSite: "lax",
			secrets: [env.SESSION_SECRET],
			maxAge,
		},
	});
}

export function commitSession(session: SessionResult) {
	const sessionStorage = getSessionStorage();

	return sessionStorage.commitSession(session, {
		expires: new Date(Date.now() + maxAge * 1000),
	});
}

export function destroySession(session: SessionResult) {
	const sessionStorage = getSessionStorage();

	return sessionStorage.destroySession(session);
}

export function getSession(request: Request): Promise<SessionResult> {
	const cookie = request.headers.get("Cookie");

	const sessionStorage = getSessionStorage();

	return sessionStorage.getSession(cookie);
}
