import { type DefiniteError, fail, type MaybeError } from "@firtoz/maybe-error";
import { type ActionFunctionArgs, data } from "react-router";
import { z } from "zod";
import { zfd } from "zod-form-data";
import { fromError } from "zod-validation-error";

export const formAction = <
	TSchema extends z.ZodTypeAny,
	TResult = undefined,
	TError = undefined,
	ActionArgs extends ActionFunctionArgs = ActionFunctionArgs,
>({
	schema,
	validate,
	handler,
}: {
	schema: TSchema;
	validate?: (args: ActionArgs) => Promise<MaybeError<undefined, DefiniteError<TError>>>;
	handler: (args: ActionArgs, data: z.infer<TSchema>) => Promise<MaybeError<TResult, TError>>;
}) => {
	return async (args: ActionArgs): Promise<MaybeError<TResult, TError>> => {
		if (validate) {
			const validationResult = await validate(args);
			if (!validationResult.success) {
				return validationResult.error;
			}
		}

		try {
			const rawFormData = await args.request.formData();
			const formData = await zfd.formData(schema).safeParseAsync(rawFormData);

			if (!formData.success) {
				const error = fromError(formData.error, {
					prefix: "",
					issueSeparator: "\n",
					messageBuilder: (issues) => {
						return issues
							.map((issue) => {
								const fieldName = issue.path.length > 0 ? issue.path[issue.path.length - 1] : "";
								const capitalizedField =
									typeof fieldName === "string"
										? fieldName.charAt(0).toUpperCase() + fieldName.slice(1)
										: String(fieldName);

								if (issue.code === "invalid_type") {
									// After narrowing by code, TypeScript knows this has expected property
									if (issue.message.includes("received undefined")) {
										return `"${capitalizedField}" is required`;
									}
									
									return `"${capitalizedField}" must be a ${issue.expected}`;
								}

								return `${capitalizedField}: ${issue.message}`;
							})
							.join("\n");
					},
				});

				console.log("error", error, rawFormData);
				throw data(fail(error.message) as unknown as MaybeError<TResult, TError>, {
					status: 400,
				});
			}

			return handler(args, formData.data);
		} catch (error) {
			if (error instanceof Response) {
				throw error;
			}

			console.error(error);
			throw data(fail("Invalid form data") as unknown as MaybeError<TResult, TError>, {
				status: 400,
			});
		}
	};
};
