import { pino } from 'pino';

import type { Config } from '../config.js';

export type Logger = pino.Logger;

/** JSON logs to stdout; silent in tests unless LOG_LEVEL is set. */
export function createLogger(
    config: Pick<Config, 'NODE_ENV' | 'LOG_LEVEL'>,
): Logger {
    return pino({
        level:
            config.LOG_LEVEL ??
            (config.NODE_ENV === 'test' ? 'silent' : 'info'),
        redact: ['req.headers.cookie', 'req.headers.authorization'],
    });
}
