import type { ApiErrorBody } from '@reelstack/shared';
import type { Response } from 'express';
import type { z } from 'zod';

/** First message per top-level field. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
    const errors: Record<string, string> = {};

    for (const issue of error.issues) {
        const field = String(issue.path[0] ?? 'form');
        errors[field] ??= issue.message;
    }

    return errors;
}

export function sendValidationErrors(
    res: Response,
    errors: Record<string, string>,
): void {
    const body: ApiErrorBody = {
        message: Object.values(errors)[0] ?? 'The given data was invalid.',
        errors,
    };
    res.status(422).json(body);
}

/** Parses `data` with `schema`; on failure sends a 422 and returns undefined. */
export function parseOr422<S extends z.ZodType>(
    schema: S,
    data: unknown,
    res: Response,
): z.output<S> | undefined {
    const result = schema.safeParse(data ?? {});

    if (!result.success) {
        sendValidationErrors(res, fieldErrors(result.error));
        return undefined;
    }

    return result.data;
}
