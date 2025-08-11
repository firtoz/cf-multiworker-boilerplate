import { env } from "cloudflare:workers";
import { Welcome } from "../welcome/welcome";
import type { Route } from "./+types/home";

export function meta(_args: Route.MetaArgs) {
	return [
		{ title: "Cloudflare Multi-Worker App" },
		{ name: "description", content: "A boilerplate for Cloudflare Workers with React Router" },
	];
}

export async function loader(_args: Route.LoaderArgs) {
	// Example of using a Durable Object
	const ExampleDoNamespace = env.ExampleDo;
	const ExampleDo = ExampleDoNamespace.get(ExampleDoNamespace.idFromName("example"));
	const response = await ExampleDo.fetch("https://example.com");

	return {
		message: env.VALUE_FROM_CLOUDFLARE,
		response: await response.text(),
	};
}

export default function Home({ loaderData }: Route.ComponentProps) {
	return (
		<div className="container mx-auto p-4">
			<Welcome message={loaderData.message} doResponse={loaderData.response} />
		</div>
	);
}
