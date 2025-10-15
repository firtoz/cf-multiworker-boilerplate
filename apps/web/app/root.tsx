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
		// Security header that prevents MIME type sniffing attacks. Forces browsers to respect
		// the declared Content-Type instead of guessing, preventing malicious files disguised
		// as safe types (e.g., executable code masked as an image) from being executed.
		// See: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options
		"X-Content-Type-Options": "nosniff",
		// HTTP Link headers for early connection hints - allows browser to start DNS/TCP/TLS
		// handshakes before HTML parsing, reducing font loading latency by ~100-200ms.
		// See: https://web.dev/articles/preconnect-and-dns-prefetch
		Link: [
			"<https://fonts.googleapis.com>; rel=preconnect",
			"<https://fonts.gstatic.com>; rel=preconnect; crossorigin",
		].join(", "),
	};
}

export const links: Route.LinksFunction = () => [
	// Preconnect to Google Fonts domains - establishes early connections to reduce latency.
	// fonts.googleapis.com serves the CSS, fonts.gstatic.com serves the actual font files.
	// crossOrigin needed for fonts.gstatic.com because font files are fetched as CORS requests.
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
				{/* 
					Critical CSS for dark mode FOUC prevention - industry standard practice
					Prevents white flash on page load for users with dark mode preference
					See: https://web.dev/articles/prefers-color-scheme#dark-mode-but-add-an-opt-out
				*/}
				<style
					// biome-ignore lint/security/noDangerouslySetInnerHtml: We need to set the color scheme of the html tag to light dark
					dangerouslySetInnerHTML={{
						__html: `
							html { color-scheme: light dark; }
							html, body { 
								background-color: #fff; 
								color: #111; 
							}
							@media (prefers-color-scheme: dark) {
								html, body { 
									background-color: #030712; 
									color: #f6f3f4; 
								}
							}
						`,
					}}
				/>
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
