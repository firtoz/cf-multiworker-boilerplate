import { env } from "cloudflare:workers";
import { honoDoFetcherWithName } from "@firtoz/hono-fetcher";
import { href, Link } from "react-router";
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

	// Fetch the status
	const statusResponse = await api.get({ url: "/" });
	const statusData = await statusResponse.json();

	// Increment the count - types are automatically inferred!
	const countResponse = await api.post({ url: "/count" });
	const countData = await countResponse.json();

	return {
		message: env.VALUE_FROM_CLOUDFLARE,
		status: statusData,
		count: countData.count,
	};
}

export default function Home({ loaderData }: Route.ComponentProps) {
	return (
		<div className="container mx-auto p-4">
			<Welcome
				message={loaderData.message}
				doResponse={JSON.stringify(loaderData.status, null, 2)}
			/>

			<div className="max-w-[600px] mx-auto mt-8 p-6 bg-green-50 dark:bg-green-900/30 border border-gray-200 dark:border-gray-700 rounded-3xl">
				<h2 className="text-2xl font-bold mb-2 text-gray-800 dark:text-gray-100">
					📊 Example DO State
				</h2>
				<p className="text-gray-700 dark:text-gray-300 mb-2">The ExampleDo has been accessed:</p>
				<p className="text-4xl font-bold text-green-600 dark:text-green-400 mb-4">
					{loaderData.count} times
				</p>
				<p className="text-sm text-gray-600 dark:text-gray-400">
					This count is stored in the Durable Object's persistent storage and increments on each
					page load.
				</p>
			</div>

			<div className="max-w-[600px] mx-auto mt-8 p-6 bg-blue-50 dark:bg-blue-900/30 border border-gray-200 dark:border-gray-700 rounded-3xl">
				<h2 className="text-2xl font-bold mb-2 text-gray-800 dark:text-gray-100">
					🚀 Multi-Worker Demo
				</h2>
				<p className="text-gray-700 dark:text-gray-300 mb-4">
					See Durable Objects communicating in action with our work queue demo.
				</p>
				<Link
					to={href("/queue")}
					className="inline-block bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
				>
					View Work Queue Demo →
				</Link>
			</div>
		</div>
	);
}
