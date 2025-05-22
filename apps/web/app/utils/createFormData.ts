import type { z } from "zod";
import { fromError } from "zod-validation-error";
import { type MaybeError, fail, success } from "./MaybeError";

/**
 * Creates a FormData object from validated data using a Zod schema
 * @param schema The Zod schema to validate against
 * @param inputData The data to validate and convert to FormData
 * @returns A MaybeError containing either the FormData object or an error message
 */
export const createFormData = <TSchema extends z.ZodTypeAny>(
	schema: TSchema,
	inputData: z.infer<TSchema>,
): MaybeError<FormData, boolean, string> => {
	try {
		// Validate the input data against the schema
		const result = schema.safeParse(inputData);

		if (!result.success) {
			const error = fromError(result.error, {
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

							if (issue.code === "invalid_type" && issue.received === "undefined") {
								return `"${capitalizedField}" is required`;
							}

							if (issue.code === "invalid_type") {
								return `"${capitalizedField}" must be a ${issue.expected}`;
							}

							return `${capitalizedField}: ${issue.message}`;
						})
						.join("\n");
				},
			});

			return fail(error.message);
		}

		// Create a new FormData object
		const formData = new FormData();

		// Add each field to the FormData object
		const validData = result.data as Record<string, unknown>;

		for (const [key, value] of Object.entries(validData)) {
			if (value === undefined || value === null) {
				continue;
			}

			// Handle arrays (e.g., for repeatable fields)
			if (Array.isArray(value)) {
				for (const item of value) {
					appendToFormData(formData, key, item);
				}
			} else {
				appendToFormData(formData, key, value);
			}
		}

		return success(formData);
	} catch (error) {
		console.error("Error creating FormData:", error);
		return fail(error instanceof Error ? error.message : "Failed to create FormData");
	}
};

/**
 * Helper function to append values to FormData with proper type handling
 */
const appendToFormData = (formData: FormData, key: string, value: unknown): void => {
	if (value instanceof File) {
		formData.append(key, value);
	} else if (value instanceof Blob) {
		formData.append(key, value);
	} else if (typeof value === "boolean") {
		formData.append(key, value ? "true" : "false");
	} else if (value instanceof Date) {
		formData.append(key, value.toISOString());
	} else if (typeof value === "object" && value !== null) {
		formData.append(key, JSON.stringify(value));
	} else {
		formData.append(key, String(value));
	}
};
