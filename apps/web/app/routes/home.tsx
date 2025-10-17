import { env } from "cloudflare:workers";
import { honoDoFetcherWithName } from "@firtoz/hono-fetcher";
import { Suspense } from "react";
import { Await, href, Link } from "react-router";
import { Welcome } from "../welcome/welcome";
import type { Route } from "./+types/home";

export function meta(_args: Route.MetaArgs) {
	return [
		{ title: "Cloudflare Multi-Worker App" },
		{ name: "description", content: "A boilerplate for Cloudflare Workers with React Router" },
	];
}

export async function loader(_args: Route.LoaderArgs) {
	// Example of using a Durable Object with type-safe fetcher
	const api = honoDoFetcherWithName(env.ExampleDo, "example");

	// Return separate promises for more granular streaming
	const doStatusPromise = (async () => {
		const statusResponse = await api.get({ url: "/" });
		return JSON.stringify(await statusResponse.json(), null, 2);
	})();

	const doCountPromise = (async () => {
		const countResponse = await api.post({ url: "/count" });
		const countData = await countResponse.json();
		return countData.count;
	})();

	return {
		message: env.VALUE_FROM_CLOUDFLARE,
		doStatus: doStatusPromise,
		doCount: doCountPromise,
	};
}

export default function Home({ loaderData }: Route.ComponentProps) {
	return (
		<div className="container mx-auto px-4 py-4 sm:px-6 sm:py-6">
			{/* Welcome section with its own streaming for DO response */}
			<Welcome message={loaderData.message} doResponsePromise={loaderData.doStatus} />

			{/* DO State card - streams independently */}
			<div className="max-w-[600px] mx-auto mt-6 sm:mt-8 p-4 sm:p-6 bg-green-50 dark:bg-green-900/30 border border-gray-200 dark:border-gray-700 rounded-2xl sm:rounded-3xl">
				<h2 className="text-xl sm:text-2xl font-bold mb-2 text-gray-800 dark:text-gray-100">
					📊 Example DO State
				</h2>
				<p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mb-2">
					The ExampleDo has been accessed:
				</p>
				<Suspense
					fallback={
						<div className="animate-pulse">
							<div className="h-12 bg-green-200 dark:bg-green-800 rounded mb-4" />
						</div>
					}
				>
					<Await resolve={loaderData.doCount}>
						{(count) => (
							<>
								<p className="text-3xl sm:text-4xl font-bold text-green-600 dark:text-green-400 mb-3 sm:mb-4">
									{count} times
								</p>
								<p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
									This count is stored in the Durable Object's persistent storage and increments on
									each page load.
								</p>
							</>
						)}
					</Await>
				</Suspense>
			</div>

			{/* Static content - shows immediately */}
			<div className="max-w-[600px] mx-auto mt-6 sm:mt-8 p-4 sm:p-6 bg-blue-50 dark:bg-blue-900/30 border border-gray-200 dark:border-gray-700 rounded-2xl sm:rounded-3xl">
				<h2 className="text-xl sm:text-2xl font-bold mb-2 text-gray-800 dark:text-gray-100">
					🚀 Multi-Worker Demo
				</h2>
				<p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mb-4">
					See Durable Objects communicating in action with our work queue demo.
				</p>
				<Link
					to={href("/queue")}
					className="inline-block w-full sm:w-auto text-center bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
				>
					View Work Queue Demo →
				</Link>
			</div>
		</div>
	);
}
