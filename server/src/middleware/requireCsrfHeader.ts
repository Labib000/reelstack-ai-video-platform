import type { RequestHandler } from 'express';

/**
 * Cookie-authenticated routes (refresh, logout) also need a custom header. A
 * cross-site form or <img> can't set one, and a cross-site fetch that sets it
 * triggers a CORS preflight this API doesn't allow. A second layer on top of
 * the SameSite=Strict cookie.
 */
export const requireCsrfHeader: RequestHandler = (req, res, next) => {
    if (req.get('x-requested-with') !== 'XMLHttpRequest') {
        res.status(403).json({ message: 'Missing X-Requested-With header.' });
        return;
    }
    next();
};
