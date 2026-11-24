import type { ApiErrorBody } from '@reelstack/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';

import type { Logger } from '../lib/logger.js';

/** JSON 404 for unknown /api routes. */
export const apiNotFound: RequestHandler = (_req, res) => {
    const body: ApiErrorBody = { message: 'Not found.' };
    res.status(404).json(body);
};

export function errorHandler(logger: Logger): ErrorRequestHandler {
    return (err, _req, res, next) => {
        if (res.headersSent) {
            next(err);
            return;
        }

        // Malformed JSON body from express.json().
        if (
            err instanceof SyntaxError &&
            (err as SyntaxError & { type?: string }).type ===
                'entity.parse.failed'
        ) {
            res.status(400).json({ message: 'Malformed JSON body.' });
            return;
        }

        logger.error({ err }, 'Unhandled error');
        const body: ApiErrorBody = { message: 'Internal server error.' };
        res.status(500).json(body);
    };
}
