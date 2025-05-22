export type DefiniteError<TError = string> = {
	success: false;
	error: TError;
};

export type DefiniteSuccess<T = undefined> = {
	success: true;
} & (T extends undefined
	? {
			result?: T;
		}
	: {
			result: T;
		});

export type Conditional<TCondition extends boolean, TTrue, TFalse> = TCondition extends true
	? TTrue
	: TCondition extends false
		? TFalse
		: TTrue | TFalse;

export type MaybeError<
	T = undefined,
	TSuccess extends boolean = boolean,
	TError = string,
> = Conditional<TSuccess, DefiniteSuccess<T>, DefiniteError<TError>>;

export type AssumeSuccess<T extends MaybeError<unknown>> = Exclude<T, undefined> extends MaybeError<
	infer U
>
	? U
	: never;

export const success = <T = undefined>(
	...params: T extends undefined ? [] : [T]
): DefiniteSuccess<T> => {
	if (params.length === 0) {
		return { success: true } as unknown as DefiniteSuccess<T>;
	}

	return {
		success: true,
		result: params[0],
	} as unknown as DefiniteSuccess<T>;
};

export const fail = <TError = string>(error: TError): DefiniteError<TError> => {
	return {
		success: false,
		error,
	};
};
