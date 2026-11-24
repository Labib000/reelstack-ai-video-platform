import mongoose from 'mongoose';

import type { Logger } from './lib/logger.js';

export async function connectMongo(uri: string, logger?: Logger) {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5_000 });
    logger?.info('MongoDB connected');
}

export async function disconnectMongo() {
    await mongoose.disconnect();
}

export function mongoStatus(): 'up' | 'down' {
    return mongoose.connection.readyState === 1 ? 'up' : 'down';
}
