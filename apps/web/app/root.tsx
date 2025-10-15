import {
	isRouteErrorResponse,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

const FONT_URL = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";

export function headers(_args: Route.HeadersArgs) {
	return {
		"X-Content-Type-Options": "nosniff",
		Link: [
			"<https://fonts.googleapis.com>; rel=preconnect",
			"<https://fonts.gstatic.com>; rel=preconnect; crossorigin",
		].join(", "),
	};
}

export const links: Route.LinksFunction = () => [
	{ rel: "preconnect", href: "https://fonts.googleapis.com" },
	{
		rel: "preconnect",
		href: "https://fonts.gstatic.com",
		crossOrigin: "anonymous",
	},
	{
		rel: "preload",
		href: FONT_URL,
		as: "style",
	},
	{
		rel: "stylesheet",
		href: FONT_URL,
		media: "print",
		onLoad: "this.media='all'",
	},
];

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
				{/*
					Async font loading using the "media print trick" - prevents Google Fonts from blocking render.
					The stylesheet is loaded with media="print" so it doesn't block, then this script immediately
					switches it to media="all" once parsed. This eliminates the 230ms render-blocking delay.
					See: https://www.filamentgroup.com/lab/load-css-simpler/
				*/}
				<script
					// biome-ignore lint/security/noDangerouslySetInnerHtml: Safe inline script for async font loading performance optimization
					dangerouslySetInnerHTML={{
						__html: `(function(){var l=document.querySelector('link[media="print"]');if(l){l.media='all';}})();`,
					}}
				/>
				<noscript>
					<link rel="stylesheet" href={FONT_URL} />
				</noscript>
			</head>
			<body>
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export default function App() {
	return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	let message = "Oops!";
	let details = "An unexpected error occurred.";
	let stack: string | undefined;

	if (isRouteErrorResponse(error)) {
		message = error.status === 404 ? "404" : "Error";
		details =
			error.status === 404 ? "The requested page could not be found." : error.statusText || details;
	} else if (import.meta.env.DEV && error && error instanceof Error) {
		details = error.message;
		stack = error.stack;
	}

	return (
		<main className="pt-16 p-4 container mx-auto">
			<h1>{message}</h1>
			<p>{details}</p>
			{stack && (
				<pre className="w-full p-4 overflow-x-auto">
					<code>{stack}</code>
				</pre>
			)}
		</main>
	);
}
