import {
	type FetcherFormProps,
	type Register,
	type SubmitOptions,
	href,
	useFetcher,
} from "react-router";

import type * as T from "react-router/route-module";

import { useCallback, useMemo } from "react";
import type { z } from "zod";
import type { HrefArgs } from "./HrefArgs";

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
type Func = (...args: any[]) => unknown;

type RouteModule = {
	meta?: Func;
	links?: Func;
	headers?: Func;
	loader?: Func;
	clientLoader?: Func;
	action: Func;
	clientAction?: Func;
	HydrateFallback?: unknown;
	default?: unknown;
	ErrorBoundary?: unknown;
	formSchema: z.ZodTypeAny;
	[key: string]: unknown;
};

type SubmitFunc<TModule extends RouteModule> = (
	target: z.infer<TModule["formSchema"]>,
	options: Omit<SubmitOptions, "action" | "method" | "encType"> & {
		method: Exclude<SubmitOptions["method"], "GET">;
	},
) => Promise<void>;

type SubmitForm = (
	props: Omit<FetcherFormProps & React.RefAttributes<HTMLFormElement>, "action">,
) => React.ReactElement;

export const useDynamicSubmitter = <
	TInfo extends {
		path: string;
		actionData: T.CreateActionData<RouteModule>;
		module: RouteModule;
	},
	TModule extends RouteModule = TInfo["module"],
>(
	path: TInfo["path"] extends "undefined"
		? "/"
		: `/${TInfo["path"]}` extends keyof Register["params"]
			? `/${TInfo["path"]}`
			: never,
	...args: TInfo["path"] extends "undefined"
		? HrefArgs<"/">
		: `/${TInfo["path"]}` extends keyof Register["params"]
			? HrefArgs<`/${TInfo["path"]}`>
			: never
): Omit<ReturnType<typeof useFetcher<TInfo["actionData"]>>, "load" | "submit" | "Form"> & {
	submit: SubmitFunc<TModule>;
	Form: SubmitForm;
} => {
	const url = useMemo(() => {
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		return href<typeof path>(path, ...(args as any));
	}, [path, args]);

	const fetcher = useFetcher<TInfo["actionData"]>({ key: `submitter-${url}` });

	const submit: SubmitFunc<TModule> = useCallback(
		(target, options) => {
			// console.log("Submitting form to", url, target, options);
			return fetcher.submit(target, {
				...options,
				action: url,
				encType: "multipart/form-data",
			});
		},
		[fetcher.submit, url],
	);

	const OriginalForm = fetcher.Form;

	const Form: SubmitForm = useCallback(
		(props) => {
			return <OriginalForm action={url} {...props} />;
		},
		[url, OriginalForm],
	);

	return {
		...fetcher,
		submit,
		Form,
	};
};
