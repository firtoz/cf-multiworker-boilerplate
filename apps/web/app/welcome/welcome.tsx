import { Suspense } from "react";
import { Await } from "react-router";
import { cn } from "~/lib/cn";

// Icon styling constants
const ICON_CONTAINER_SIZE = 40; // 40px container
const ICON_SIZE = 24; // 28px icons (40 - 2*6 = 28 for ~6px margin)

const iconContainerClassName = cn(
	"rounded-xl bg-gray-100/50 dark:bg-gray-800/50",
	"group-hover:bg-gray-200/70 dark:group-hover:bg-gray-700/70",
	"transition-colors",
	"flex items-center justify-center",
);

type ResourceInfo = {
	href: string;
	text: string;
	iconSrc: string;
	iconAlt: string;
	iconWidth?: number;
};

// Resource icon component with consistent styling
function ResourceIcon({ info }: { info: ResourceInfo }) {
	return (
		<li key={info.href}>
			<a
				className="group flex items-center gap-3 self-stretch p-3 leading-normal text-blue-700 hover:underline dark:text-blue-500"
				href={info.href}
				target="_blank"
				rel="noreferrer"
			>
				<div
					className={iconContainerClassName}
					style={{ width: ICON_CONTAINER_SIZE, height: ICON_CONTAINER_SIZE }}
				>
					<img src={info.iconSrc} alt={info.iconAlt} width={info.iconWidth ?? ICON_SIZE} />
				</div>
				{info.text}
			</a>
		</li>
	);
}

export function Welcome({
	message,
	doResponsePromise,
}: {
	message: string;
	doResponsePromise?: Promise<string>;
}) {
	return (
		<main className="flex items-center justify-center pt-16 pb-4">
			<div className="flex-1 flex flex-col items-center gap-16 min-h-0">
				<header className="flex flex-col items-center gap-9">
					<div className="w-[500px] max-w-[100vw] p-4">
						<h1 className="text-4xl font-bold text-center text-blue-600 dark:text-blue-400">
							Cloudflare Multi-Worker Boilerplate
						</h1>
					</div>
				</header>
				<div className="max-w-[600px] w-full space-y-6 px-4">
					<nav className="rounded-3xl border border-gray-200 p-6 dark:border-gray-700 space-y-4">
						<p className="leading-6 text-gray-700 dark:text-gray-200 text-center">
							Welcome to your new application!
						</p>
						<div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg">
							<p className="text-blue-800 dark:text-blue-200">
								This is a generic boilerplate for Cloudflare multi-worker applications. It includes
								a web app with React and a Durable Object.
							</p>
						</div>
						<ul className="space-y-2">
							{resources.map((item) => (
								<ResourceIcon key={item.href} info={item} />
							))}
							<li className="self-stretch p-3 leading-normal bg-gray-50 dark:bg-gray-800 rounded-lg mt-4">
								<span className="font-semibold">Environment value:</span> {message}
							</li>
							{doResponsePromise && (
								<Suspense
									fallback={
										<li className="self-stretch p-3 leading-normal bg-gray-50 dark:bg-gray-800 rounded-lg mt-4">
											<div className="animate-pulse">
												<span className="font-semibold">Durable Object Response:</span>
												<div className="mt-2 p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 h-20" />
											</div>
										</li>
									}
								>
									<Await resolve={doResponsePromise}>
										{(doResponse) => (
											<li className="self-stretch p-3 leading-normal bg-gray-50 dark:bg-gray-800 rounded-lg mt-4">
												<div>
													<span className="font-semibold">Durable Object Response:</span>
													<pre className="mt-2 p-3 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 rounded-lg border border-gray-200 dark:border-gray-700 font-mono text-sm overflow-auto">
														{doResponse}
													</pre>
												</div>
											</li>
										)}
									</Await>
								</Suspense>
							)}
						</ul>
					</nav>
				</div>
			</div>
		</main>
	);
}

const resources: ResourceInfo[] = [
	// Cloudflare Resources
	{
		href: "https://developers.cloudflare.com/workers/",
		text: "Cloudflare Workers",
		iconSrc: "/icons/cloudflare-workers.svg",
		iconAlt: "Cloudflare Workers Documentation",
	},
	{
		href: "https://developers.cloudflare.com/durable-objects/",
		text: "Durable Objects",
		iconSrc: "/icons/durable-objects.svg",
		iconAlt: "Durable Objects Documentation",
	},
	// Framework & Libraries
	{
		href: "https://reactrouter.com/",
		text: "React Router",
		iconSrc: "/icons/react-router.svg",
		iconAlt: "React Router Documentation",
		iconWidth: 44,
	},

	// Monorepo Tools
	{
		href: "https://turborepo.com/",
		text: "Turborepo",
		iconSrc: "/icons/turborepo.svg",
		iconAlt: "Turborepo Documentation",
		iconWidth: 18,
	},
	{
		href: "https://zod.dev/",
		text: "Zod",
		iconSrc: "/icons/zod-logo.png",
		iconAlt: "Zod Documentation",
		iconWidth: 18,
	},
];
