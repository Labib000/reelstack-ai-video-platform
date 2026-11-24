import type { Role } from '@reelstack/shared';

declare global {
    namespace Express {
        interface Request {
            /** Set by requireAuth. */
            user?: { id: string; role: Role };
        }
    }
}

export {};
