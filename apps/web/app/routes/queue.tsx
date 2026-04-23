import { env } from "cloudflare:workers";
import { honoDoFetcherWithName } from "@firtoz/hono-fetcher";
import { fail, type MaybeError, success } from "@firtoz/maybe-error";
import {
	formAction,
	type RoutePath,
	type SubmitterSettledData,
	SubmitterSupersededError,
	SubmitterUnmountedError,
	useDynamicSubmitter,
} from "@firtoz/router-toolkit";
import {
	Fragment,
	memo,
	type SubmitEvent,
	Suspense,
	useCallback,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { Await, href, Link, useRevalidator } from "react-router";
import { z } from "zod";
import { zfd } from "zod-form-data";
import { cn } from "~/lib/cn";
import type { Route } from "./+types/queue";

const { repeatable } = zfd;

// Component for individual message input with proper ID
const MessageInput = memo(
	({
		index,
		value,
		onChange,
		onRemove,
		onAdd,
		disabled,
		isLast,
		canRemove,
	}: {
		index: number;
		value: string;
		onChange: (value: string) => void;
		onRemove: () => void;
		onAdd: () => void;
		disabled: boolean;
		isLast: boolean;
		canRemove: boolean;
	}) => {
		const inputId = useId();

		return (
			<div className="flex lg:flex-row flex-col gap-2 flex-1">
				<label
					htmlFor={inputId}
					className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap items-center content-center"
				>
					Message {index + 1}:
				</label>
				<div className="flex items-center gap-2 flex-1 min-w-0">
					<input
						type="text"
						name="messages"
						id={inputId}
						value={value}
						onChange={(e) => onChange(e.target.value)}
						disabled={disabled}
						className={cn(
							"flex-1 min-w-0 lg:w-64 xl:w-96 px-3 py-2 border rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500",
							{
								"opacity-50": disabled,
								"border-gray-300 dark:border-gray-600": true,
							},
						)}
						placeholder={`Enter message ${index + 1}...`}
					/>
					{canRemove && (
						<button
							type="button"
							onClick={onRemove}
							disabled={disabled}
							className={cn(
								"px-3 py-2 bg-red-200 hover:bg-red-300 dark:bg-red-900 dark:hover:bg-red-800 text-red-800 dark:text-red-200 rounded-md font-bold transition-colors shrink-0",
								{ "opacity-50 cursor-not-allowed": disabled },
							)}
						>
							−
						</button>
					)}
					{isLast && (
						<button
							type="button"
							onClick={onAdd}
							disabled={disabled}
							className={cn(
								"px-3 py-2 bg-green-200 hover:bg-green-300 dark:bg-green-900 dark:hover:bg-green-800 text-green-800 dark:text-green-200 rounded-md font-bold transition-colors shrink-0",
								{ "opacity-50 cursor-not-allowed": disabled },
							)}
						>
							+
						</button>
					)}
				</div>
			</div>
		);
	},
);

// Export route for type safety
export const route: RoutePath<"/queue"> = "/queue";

type WorkQueueItem = {
	id: string;
	status: "pending" | "processing" | "completed" | "failed";
	payload: unknown;
	result?: unknown;
	error?: string;
	timestamps?: Array<{ tag: string; time: number }>;
	timeTaken?: number;
	createdAt: number;
	updatedAt: number;
};

// Form schema - defines what the web app sends to the coordinator
// zfd handles coercion from FormData strings to proper types
export const formSchema = zfd.formData({
	delay: zfd.numeric(z.number().min(0).max(5000)),
	messages: repeatable(z.array(zfd.text(z.string().min(1, "Message is required"))).min(1)),
	directMode: zfd.checkbox(),
});

export function meta() {
	return [{ title: "Work Queue - Multi-Worker Demo" }];
}

export async function loader(): Promise<MaybeError<{ queue: Promise<WorkQueueItem[]> }>> {
	const queueDataPromise = (async (): Promise<WorkQueueItem[]> => {
		const api = honoDoFetcherWithName(env.CoordinatorDo, "main-coordinator");
		const response = await api.get({ url: "/queue" });
		const data = (await response.json()) as { queue: WorkQueueItem[] };
		return data.queue;
	})();

	return success({ queue: queueDataPromise });
}

export const action = formAction({
	schema: formSchema,
	handler: async (_args, data) => {
		// data type is automatically inferred from formSchema
		const { delay, messages, directMode } = data;
		const mode = directMode ? "direct" : "queue";

		try {
			const api = honoDoFetcherWithName(env.CoordinatorDo, "main-coordinator");

			if (messages.length === 1) {
				// Single submission - timestamps start at coordinator
				const response = await api.post({
					url: "/queue",
					body: { message: messages[0], delay, mode },
				});
				const responseData = await response.json();

				return success({
					count: 1,
					items: [responseData.workItem],
				});
			} else {
				// Batch submission
				const response = await api.post({
					url: "/queue/batch",
					body: {
						messages,
						delay,
						mode,
					},
				});
				const responseData = await response.json();

				// Check if we got an error response
				if ("error" in responseData) {
					return fail(responseData.error as string);
				}

				return success({
					count: messages.length,
					items: responseData.workItems,
				});
			}
		} catch (error) {
			console.error("Error submitting work:", error);
			const errorMsg = error instanceof Error ? error.message : String(error);
			return fail(`Failed to add work item(s) to queue: ${errorMsg}`);
		}
	},
});

type QueueRouteModule = typeof import("./queue");

export default function Queue({ loaderData }: Route.ComponentProps) {
	const revalidator = useRevalidator();
	const submitter = useDynamicSubmitter<QueueRouteModule>("/queue");
	const submitSeq = useRef(0);

	const formatTime = useCallback((timestamp: number) => {
		return new Date(timestamp).toLocaleTimeString();
	}, []);

	const delayId = useId();

	const [busy, setBusy] = useState(false);
	const [actionResult, setActionResult] = useState<SubmitterSettledData<QueueRouteModule> | null>(
		null,
	);

	// Track which fields have been modified since the error was displayed
	const [modifiedFields, setModifiedFields] = useState<Set<string>>(new Set());
	// Track messages for each item
	const [messages, setMessages] = useState<string[]>(["Process this data"]);
	const [delay, setDelay] = useState(0);
	const [directMode, setDirectMode] = useState(false);

	// Clear error for a specific field when it's modified
	const handleFieldChange = useCallback((fieldName: string) => {
		setModifiedFields((prev) => new Set(prev).add(fieldName));
	}, []);

	// Add a new message
	const addMessage = useCallback(() => {
		setMessages((prev) => [...prev, `Process this data ${prev.length + 1}`]);
	}, []);

	// Remove a message at index
	const removeMessage = useCallback((index: number) => {
		setMessages((prev) => prev.filter((_, i) => i !== index));
	}, []);

	const handleSubmit = useCallback(
		async (e: SubmitEvent<HTMLFormElement>) => {
			e.preventDefault();
			const id = ++submitSeq.current;
			setModifiedFields(new Set());
			setBusy(true);
			try {
				const data = await submitter.submitJson({
					delay,
					messages,
					directMode,
				});
				if (id !== submitSeq.current) {
					return;
				}
				setActionResult(data);
				if (data.success) {
					revalidator.revalidate();
				}
			} catch (err) {
				if (err instanceof SubmitterSupersededError || err instanceof SubmitterUnmountedError) {
					return;
				}
				if (id !== submitSeq.current) {
					return;
				}
				console.error("Queue submit failed:", err);
			} finally {
				if (id === submitSeq.current) {
					setBusy(false);
				}
			}
		},
		[delay, directMode, messages, revalidator, submitter],
	);

	// Compute field errors once - returns mapped object of field -> errors[]
	const fieldErrors = useMemo(() => {
		const errors: Record<keyof z.infer<typeof formSchema>, string[]> = {
			delay: [],
			messages: [],
			directMode: [],
		};

		if (busy) {
			return errors;
		}

		if (
			actionResult &&
			!actionResult.success &&
			actionResult.error.type === "validation" &&
			actionResult.error.error.properties
		) {
			const properties = actionResult.error.error.properties;
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
	}, [actionResult, busy, modifiedFields]);

	if (!loaderData.success) {
		return (
			<div className="container mx-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 max-w-6xl">
				<div className="mb-4 sm:mb-6">
					<Link
						to={href("/")}
						className="inline-flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm sm:text-base py-2"
					>
						⬅️ Back to Home
					</Link>
				</div>
				<p className="text-red-600 dark:text-red-400" role="alert">
					{loaderData.error}
				</p>
			</div>
		);
	}

	const { queue } = loaderData.result;

	return (
		<div className="container mx-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 max-w-6xl">
			{/* Static content - shows immediately */}
			<div className="mb-4 sm:mb-6">
				<Link
					to={href("/")}
					className="inline-flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm sm:text-base py-2"
				>
					⬅️ Back to Home
				</Link>
			</div>
			<h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-gray-900 dark:text-gray-100">
				Work Queue Demo
			</h1>

			{/* Architecture section - static, shows immediately */}
			<div className="mb-6 sm:mb-8 p-4 sm:p-6 bg-blue-50 dark:bg-blue-900/30 border border-gray-200 dark:border-gray-700 rounded-lg">
				<h2 className="text-lg sm:text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100 hyphens-auto wrap-break-word">
					Architecture
				</h2>
				<p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mb-3 hyphens-auto wrap-break-word">
					This demonstrates queue-based multi-worker communication using Cloudflare Queues:
				</p>
				<div className="flex flex-col sm:flex-row lg:flex-col gap-4">
					<div className="font-mono text-xs sm:text-sm bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 p-3 rounded border border-gray-200 dark:border-gray-700 overflow-x-auto flex flex-col lg:flex-row gap-2 justify-center items-center">
						{[
							"Web App",
							"CoordinatorDo",
							"Cloudflare Queue",
							"ProcessorDo",
							"Results back to CoordinatorDo",
						].map((item, index, list) => {
							return (
								<Fragment key={index.toString()}>
									<div className="items-center text-center">{item}</div>
									{index < list.length - 1 && (
										<>
											<div className="not-lg:hidden">➡️</div>
											<div className="lg:hidden">⬇️</div>
										</>
									)}
								</Fragment>
							);
						})}
					</div>
					<div className="mt-3 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
						<p className="mb-1 font-semibold">Benefits:</p>
						<ul className="list-disc ml-5 space-y-1">
							<li>Decoupled: Workers don't need direct knowledge of each other</li>
							<li>Reliable: Built-in retries and guaranteed delivery</li>
							<li>Scalable: Multiple processors can consume from the same queue</li>
							<li>Batch Processing: Messages can be processed in batches for efficiency</li>
						</ul>
					</div>
				</div>
			</div>

			{/* Success/error messages - static, based on form submission */}
			{actionResult?.success && actionResult.result && (
				<div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-green-50 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg">
					<p className="text-sm sm:text-base font-semibold text-green-800 dark:text-green-200 break-all">
						✓{" "}
						{actionResult.result.count === 1
							? `Work item added to queue: ${actionResult.result.items?.[0]?.id}`
							: `${actionResult.result.count} work items added to queue`}
					</p>
				</div>
			)}

			{actionResult && !actionResult.success && actionResult.error.type === "handler" && (
				<div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
					<p className="text-sm sm:text-base font-semibold text-red-800 dark:text-red-200 mb-2">
						✗ Error:
					</p>
					<p className="text-sm sm:text-base text-red-700 dark:text-red-300">
						{actionResult.error.error}
					</p>
				</div>
			)}

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
				{/* Add Work Form - static, shows immediately */}
				<div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg border border-gray-200 dark:border-gray-700">
					<h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4 text-gray-900 dark:text-gray-100">
						Add Work to Queue
					</h2>
					<form method="post" onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-3">
							{messages.map((msg, idx) => (
								<MessageInput
									key={`message-${idx.toString()}-${messages.length}`}
									index={idx}
									value={msg}
									onChange={(value) => {
										const newMessages = [...messages];
										newMessages[idx] = value;
										setMessages(newMessages);
									}}
									onRemove={() => removeMessage(idx)}
									onAdd={addMessage}
									disabled={busy}
									isLast={idx === messages.length - 1}
									canRemove={messages.length > 1}
								/>
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
								disabled={busy}
								value={delay}
								onChange={(e) => {
									setDelay(e.target.valueAsNumber || 0);
									handleFieldChange("delay");
								}}
								className={cn(
									"w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500",
									{
										"opacity-50": busy,
										"border-red-500 dark:border-red-500": fieldErrors.delay?.length > 0,
										"border-gray-300 dark:border-gray-600": !fieldErrors.delay?.length,
									},
								)}
							/>
							{fieldErrors.delay?.length ? (
								fieldErrors.delay.map((error, i) => (
									<p key={i.toString()} className="mt-1 text-sm text-red-600 dark:text-red-400">
										{error}
									</p>
								))
							) : (
								<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
									Simulates work processing time (0-5000ms, use 0 for benchmarking)
								</p>
							)}
						</div>
						<div>
							<label className="flex items-center gap-3 cursor-pointer">
								<input
									type="checkbox"
									name="directMode"
									checked={directMode}
									onChange={(e) => {
										setDirectMode(e.target.checked);
										handleFieldChange("directMode");
									}}
									disabled={busy}
									className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
								/>
								<span className="text-sm font-medium text-gray-700 dark:text-gray-300">
									Use Direct Messaging (bypass queue)
								</span>
							</label>
							<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
								When checked, messages are sent directly to ProcessorDo without using Cloudflare
								Queues (faster, but less scalable)
							</p>
						</div>
						<button
							type="submit"
							disabled={busy}
							className={cn(
								"w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white py-2 px-4 rounded-md font-medium transition-colors",
								{ "opacity-50 cursor-not-allowed": busy },
							)}
						>
							{busy ? "Adding..." : "Add to Queue"}
						</button>
					</form>
				</div>

				{/* Queue Status - only this streams */}
				<div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg border border-gray-200 dark:border-gray-700">
					<div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
						<h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100">
							Queue Status
						</h2>
						<button
							type="button"
							onClick={() => revalidator.revalidate()}
							disabled={revalidator.state === "loading"}
							className={cn(
								"text-xs sm:text-sm bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 px-2 sm:px-3 py-1.5 sm:py-2 rounded transition-colors whitespace-nowrap shrink-0",
								{ "opacity-50": revalidator.state === "loading" },
							)}
						>
							{revalidator.state === "loading" ? "🔄 Refreshing..." : "🔄 Refresh"}
						</button>
					</div>
					<Suspense
						fallback={
							<div className="text-sm text-gray-600 dark:text-gray-400 mb-4 animate-pulse">
								Loading queue data...
							</div>
						}
					>
						<Await resolve={queue}>
							{(items) => (
								<div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
									Total items: {items.length}
								</div>
							)}
						</Await>
					</Suspense>
				</div>
			</div>

			{/* Work Items - streams independently */}
			<div className="mt-6 sm:mt-8">
				<h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4 text-gray-900 dark:text-gray-100">
					Work Items
				</h2>
				<Suspense
					fallback={
						<div className="bg-gray-50 dark:bg-gray-800 p-8 text-center rounded-lg border border-gray-200 dark:border-gray-700">
							<div className="animate-pulse text-gray-500 dark:text-gray-400">
								Loading work items...
							</div>
						</div>
					}
				>
					<Await resolve={queue}>
						{(items) =>
							items.length === 0 ? (
								<div className="bg-gray-50 dark:bg-gray-800 p-6 sm:p-8 text-center text-gray-500 dark:text-gray-400 rounded-lg border border-gray-200 dark:border-gray-700">
									No work items in queue. Add one above!
								</div>
							) : (
								<div className="space-y-3 sm:space-y-4">
									{items
										.slice()
										.reverse()
										.map((item) => (
											<div
												key={item.id}
												className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-lg border border-gray-200 dark:border-gray-700"
											>
												<div className="flex items-start justify-between gap-2 mb-2">
													<div className="min-w-0 flex-1">
														<span className="font-mono text-xs sm:text-sm text-gray-500 dark:text-gray-400 break-all">
															{item.id.slice(0, 8)}
														</span>
													</div>
													<span
														className={cn(
															"px-2 sm:px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap shrink-0",
															{
																"bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700":
																	item.status === "pending",
																"bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700":
																	item.status === "processing",
																"bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700":
																	item.status === "completed",
																"bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700":
																	item.status === "failed",
															},
														)}
													>
														{item.status.toUpperCase()}
													</span>
												</div>
												<div className="mb-2">
													<span className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">
														Payload:
													</span>
													<pre className="mt-1 p-2 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 rounded text-xs sm:text-sm overflow-x-auto border border-gray-200 dark:border-gray-700 whitespace-pre-wrap">
														{JSON.stringify(item.payload, null, 2)}
													</pre>
												</div>
												{item.result && (
													<div className="mb-2">
														<span className="text-sm sm:text-base font-semibold text-green-700 dark:text-green-400">
															Result:
														</span>
														<pre className="mt-1 p-2 bg-green-50 dark:bg-green-900/30 text-green-900 dark:text-green-200 rounded text-xs sm:text-sm overflow-x-auto border border-green-200 dark:border-green-700 whitespace-pre-wrap">
															{JSON.stringify(item.result, null, 2)}
														</pre>
													</div>
												)}
												{item.error && (
													<div className="mb-2">
														<span className="text-sm sm:text-base font-semibold text-red-700 dark:text-red-400">
															Error:
														</span>
														<div className="mt-1 p-2 bg-red-50 dark:bg-red-900/30 rounded text-xs sm:text-sm text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700 wrap-break-word hyphens-auto">
															{item.error}
														</div>
													</div>
												)}
												{(() => {
													const stamps = item.timestamps;
													if (!stamps?.length) {
														return null;
													}
													return (
														<div className="mb-2">
															<span className="text-sm sm:text-base font-semibold text-blue-700 dark:text-blue-400">
																Timestamps:
															</span>
															{item.timeTaken !== undefined && (
																<span className="ml-2 text-xs sm:text-sm font-mono text-purple-700 dark:text-purple-400">
																	Total Time: {item.timeTaken.toFixed(3)}ms
																</span>
															)}
															<div className="mt-1 p-2 bg-blue-50 dark:bg-blue-900/30 rounded text-xs border border-blue-200 dark:border-blue-700">
																<div className="space-y-1 font-mono">
																	{stamps.map((ts, idx) => {
																		const delta =
																			idx > 0 ? (ts.time - stamps[idx - 1].time).toFixed(3) : null;
																		return (
																			<div
																				key={idx.toString()}
																				className="flex justify-between items-center text-blue-900 dark:text-blue-200"
																			>
																				<span className="font-semibold">{ts.tag}</span>
																				<div className="ml-4 flex items-center gap-2">
																					{delta && (
																						<span className="text-orange-700 dark:text-orange-400">
																							+{delta}ms
																						</span>
																					)}
																					<span className="text-gray-600 dark:text-gray-400">
																						@{ts.time.toFixed(3)}ms
																					</span>
																				</div>
																			</div>
																		);
																	})}
																</div>
															</div>
														</div>
													);
												})()}
												<div className="text-xs text-gray-500 dark:text-gray-400 flex flex-col sm:flex-row gap-1 sm:gap-4">
													<span>Created: {formatTime(item.createdAt)}</span>
													<span>Updated: {formatTime(item.updatedAt)}</span>
												</div>
											</div>
										))}
								</div>
							)
						}
					</Await>
				</Suspense>
			</div>
		</div>
	);
}
