import { env } from "cloudflare:workers";
import { honoDoFetcherWithName } from "@firtoz/hono-fetcher";
import {
	fail,
	formAction,
	type RoutePath,
	success,
	useDynamicSubmitter,
} from "@firtoz/router-toolkit";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { href, Link, useRevalidator } from "react-router";
import { z } from "zod";
import { zfd } from "zod-form-data";
import { cn } from "~/lib/cn";
import type { Route } from "./+types/queue";

// Export route for type safety
export const route: RoutePath<"/queue"> = "/queue";

// Form schema - defines what the web app sends to the coordinator
// zfd handles coercion from FormData strings to proper types
export const formSchema = zfd.formData({
	message: zfd.text(z.string().min(1, "Message is required")),
	delay: zfd.numeric(z.number().min(100).max(5000)),
});

export function meta() {
	return [{ title: "Work Queue - Multi-Worker Demo" }];
}

export async function loader() {
	const api = honoDoFetcherWithName(env.CoordinatorDo, "main-coordinator");
	const response = await api.get({ url: "/queue" });
	const data = await response.json();

	return {
		queue: data.queue,
	};
}

export const action = formAction({
	schema: formSchema,
	handler: async (_args, data) => {
		// data type is automatically inferred from formSchema (which is workPayloadSchema)
		const { message, delay } = data;

		try {
			const api = honoDoFetcherWithName(env.CoordinatorDo, "main-coordinator");
			const response = await api.post({
				url: "/queue",
				body: { message, delay },
			});
			const responseData = await response.json();

			return success({
				workItem: responseData.workItem,
			});
		} catch (_error) {
			return fail("Failed to add work item to queue");
		}
	},
});

export default function Queue({ loaderData }: Route.ComponentProps) {
	const revalidator = useRevalidator();
	const submitter = useDynamicSubmitter<typeof import("./queue")>("/queue");

	const formatTime = useCallback((timestamp: number) => {
		return new Date(timestamp).toLocaleTimeString();
	}, []);

	const messageId = useId();
	const delayId = useId();

	// Track which fields have been modified since the error was displayed
	const [modifiedFields, setModifiedFields] = useState<Set<string>>(new Set());

	useEffect(() => {
		console.log("[Queue] submitter.data", submitter.data);
		// Reset modified fields when form is submitted
		if (submitter.state === "submitting") {
			setModifiedFields(new Set());
		}
	}, [submitter.data, submitter.state]);

	// Clear error for a specific field when it's modified
	const handleFieldChange = useCallback((fieldName: string) => {
		setModifiedFields((prev) => new Set(prev).add(fieldName));
	}, []);

	// Compute field errors once - returns mapped object of field -> errors[]
	const fieldErrors = useMemo(() => {
		const errors: Record<keyof z.infer<typeof formSchema>, string[]> = {
			message: [],
			delay: [],
		};

		if (submitter.state !== "idle") {
			return errors;
		}

		if (
			submitter.data &&
			!submitter.data.success &&
			submitter.data.error.type === "validation" &&
			submitter.data.error.error.properties
		) {
			const properties = submitter.data.error.error.properties;
			for (const [fieldName, fieldError] of Object.entries(properties) as [
				[
					keyof z.infer<typeof formSchema>,
					{
						errors: string[];
					},
				],
			]) {
				// Only include errors for fields that haven't been modified
				if (!modifiedFields.has(fieldName)) {
					errors[fieldName] = fieldError?.errors || [];
				}
			}
		}

		return errors;
	}, [modifiedFields, submitter.data, submitter.state]);

	return (
		<div className="container mx-auto p-8 max-w-6xl">
			<div className="mb-6">
				<Link
					to={href("/")}
					className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
				>
					← Back to Home
				</Link>
			</div>
			<h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">Work Queue Demo</h1>

			<div className="mb-8 p-6 bg-blue-50 dark:bg-blue-900/30 border border-gray-200 dark:border-gray-700 rounded-lg">
				<h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
					Architecture
				</h2>
				<p className="text-gray-700 dark:text-gray-300 mb-2">
					This demonstrates queue-based multi-worker communication using Cloudflare Queues:
				</p>
				<div className="font-mono text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 p-3 rounded border border-gray-200 dark:border-gray-700">
					Web App → CoordinatorDo → Cloudflare Queue → ProcessorDo → Results back to Coordinator
				</div>
				<div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
					<p className="mb-1">
						<strong>Benefits:</strong>
					</p>
					<ul className="list-disc ml-5 space-y-1">
						<li>Decoupled: Workers don't need direct knowledge of each other</li>
						<li>Reliable: Built-in retries and guaranteed delivery</li>
						<li>Scalable: Multiple processors can consume from the same queue</li>
						<li>Batch Processing: Messages can be processed in batches for efficiency</li>
					</ul>
				</div>
			</div>

			{submitter.data?.success && submitter.data.result.workItem && (
				<div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg">
					<p className="font-semibold text-green-800 dark:text-green-200">
						✓ Work item added to queue: {submitter.data.result.workItem.id}
					</p>
				</div>
			)}

			{submitter.data && !submitter.data.success && submitter.data.error.type === "handler" && (
				<div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
					<p className="font-semibold text-red-800 dark:text-red-200 mb-2">✗ Error:</p>
					<p className="text-red-700 dark:text-red-300">{submitter.data.error.error}</p>
				</div>
			)}

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
				{/* Add Work Form */}
				<div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
					<h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
						Add Work to Queue
					</h2>
					<submitter.Form method="post" className="space-y-4">
						<div>
							<label
								htmlFor="message"
								className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300"
							>
								Message
							</label>
							<input
								type="text"
								name="message"
								id={messageId}
								disabled={submitter.state === "submitting"}
								onChange={() => handleFieldChange("message")}
								className={cn(
									"w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500",
									{
										"opacity-50": submitter.state === "submitting",
										"border-red-500 dark:border-red-500": fieldErrors.message?.length > 0,
										"border-gray-300 dark:border-gray-600": !fieldErrors.message?.length,
									},
								)}
								placeholder="Enter work message..."
								defaultValue="Process this data"
							/>
							{fieldErrors.message?.map((error, i) => (
								<p key={i.toString()} className="mt-1 text-sm text-red-600 dark:text-red-400">
									{error}
								</p>
							))}
						</div>
						<div>
							<label
								htmlFor="delay"
								className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300"
							>
								Processing Delay (ms)
							</label>
							<input
								type="number"
								name="delay"
								id={delayId}
								disabled={submitter.state === "submitting"}
								onChange={() => handleFieldChange("delay")}
								className={cn(
									"w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500",
									{
										"opacity-50": submitter.state === "submitting",
										"border-red-500 dark:border-red-500": fieldErrors.delay?.length > 0,
										"border-gray-300 dark:border-gray-600": !fieldErrors.delay?.length,
									},
								)}
								defaultValue="1000"
							/>
							{fieldErrors.delay?.length ? (
								fieldErrors.delay.map((error, i) => (
									<p key={i.toString()} className="mt-1 text-sm text-red-600 dark:text-red-400">
										{error}
									</p>
								))
							) : (
								<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
									Simulates work processing time (100-5000ms)
								</p>
							)}
						</div>
						<button
							type="submit"
							disabled={submitter.state === "submitting"}
							className={cn(
								"w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white py-2 px-4 rounded-md font-medium transition-colors",
								{ "opacity-50 cursor-not-allowed": submitter.state === "submitting" },
							)}
						>
							{submitter.state === "submitting" ? "Adding..." : "Add to Queue"}
						</button>
					</submitter.Form>
				</div>

				{/* Queue Status */}
				<div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
							Queue Status
						</h2>
						<button
							type="button"
							onClick={() => revalidator.revalidate()}
							disabled={revalidator.state === "loading"}
							className={cn(
								"text-sm bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 px-3 py-1 rounded transition-colors",
								{ "opacity-50": revalidator.state === "loading" },
							)}
						>
							{revalidator.state === "loading" ? "🔄 Refreshing..." : "🔄 Refresh"}
						</button>
					</div>
					<div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
						Total items: {loaderData.queue.length}
					</div>
				</div>
			</div>

			{/* Work Items */}
			<div className="mt-8">
				<h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Work Items</h2>
				{loaderData.queue.length === 0 ? (
					<div className="bg-gray-50 dark:bg-gray-800 p-8 text-center text-gray-500 dark:text-gray-400 rounded-lg border border-gray-200 dark:border-gray-700">
						No work items in queue. Add one above!
					</div>
				) : (
					<div className="space-y-4">
						{loaderData.queue
							.slice()
							.reverse()
							.map((item) => (
								<div
									key={item.id}
									className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700"
								>
									<div className="flex items-start justify-between mb-2">
										<div>
											<span className="font-mono text-sm text-gray-500 dark:text-gray-400">
												{item.id.slice(0, 8)}
											</span>
										</div>
										<span
											className={cn("px-3 py-1 rounded-full text-xs font-semibold border", {
												"bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700":
													item.status === "pending",
												"bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700":
													item.status === "processing",
												"bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700":
													item.status === "completed",
												"bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700":
													item.status === "failed",
											})}
										>
											{item.status.toUpperCase()}
										</span>
									</div>
									<div className="mb-2">
										<span className="font-semibold text-gray-900 dark:text-gray-100">Payload:</span>
										<pre className="mt-1 p-2 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 rounded text-sm overflow-auto border border-gray-200 dark:border-gray-700">
											{JSON.stringify(item.payload, null, 2)}
										</pre>
									</div>
									{item.result && (
										<div className="mb-2">
											<span className="font-semibold text-green-700 dark:text-green-400">
												Result:
											</span>
											<pre className="mt-1 p-2 bg-green-50 dark:bg-green-900/30 text-green-900 dark:text-green-200 rounded text-sm overflow-auto border border-green-200 dark:border-green-700">
												{JSON.stringify(item.result, null, 2)}
											</pre>
										</div>
									)}
									{item.error && (
										<div className="mb-2">
											<span className="font-semibold text-red-700 dark:text-red-400">Error:</span>
											<div className="mt-1 p-2 bg-red-50 dark:bg-red-900/30 rounded text-sm text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700">
												{item.error}
											</div>
										</div>
									)}
									<div className="text-xs text-gray-500 dark:text-gray-400 flex gap-4">
										<span>Created: {formatTime(item.createdAt)}</span>
										<span>Updated: {formatTime(item.updatedAt)}</span>
									</div>
								</div>
							))}
					</div>
				)}
			</div>
		</div>
	);
}
