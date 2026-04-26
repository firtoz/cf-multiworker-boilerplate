import { env } from "cloudflare:workers";
import { honoDoFetcherWithName } from "@firtoz/hono-fetcher";
import { fail, type MaybeError, success } from "@firtoz/maybe-error";
import type { RoutePath } from "@firtoz/router-toolkit";
import { BackToHomeLink } from "~/components/shared/BackToHomeLink";
import type { Route } from "./+types/ping-do";

export const route: RoutePath<"/ping-do"> = "/ping-do";

export function meta(_args: Route.MetaArgs) {
	return [
		{ title: "Ping Durable Object" },
		{ name: "description", content: "Second cross-script Durable Object (dev smoke test)" },
	];
}

type PingBody = { pong: boolean; id: string };

export async function loader(_args: Route.LoaderArgs): Promise<MaybeError<PingBody>> {
	using api = honoDoFetcherWithName(env.PingDo, "demo");
	using res = await api.get({ url: "/ping" });
	if (!res.ok) {
		return fail(`PingDo HTTP ${res.status}`);
	}
	const body = await res.json();
	if (body.pong !== true || typeof body.id !== "string") {
		return fail("Unexpected PingDo response shape");
	}
	return success({ pong: body.pong, id: body.id });
}

export default function PingDoRoute({ loaderData }: Route.ComponentProps) {
	if (!loaderData.success) {
		return (
			<div className="container mx-auto max-w-lg px-4 py-8">
				<BackToHomeLink />
				<p className="mt-6 text-red-600 dark:text-red-400">{loaderData.error}</p>
			</div>
		);
	}
	return (
		<div className="container mx-auto max-w-lg px-4 py-8">
			<BackToHomeLink />
			<h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-6">
				Ping Durable Object
			</h1>
			<p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">
				Loader calls <code className="text-xs">env.PingDo</code> (cross-script binding). If this
				page loads in dev, Miniflare resolved the ping worker via{" "}
				<code className="text-xs">auxiliaryWorkers</code>.
			</p>
			<pre className="mt-4 p-4 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm overflow-x-auto">
				{JSON.stringify(loaderData, null, 2)}
			</pre>
		</div>
	);
}
