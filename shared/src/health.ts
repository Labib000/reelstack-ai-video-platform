export type ServiceStatus = 'up' | 'down' | 'disabled';

export interface HealthResponse {
    status: 'ok' | 'degraded';
    mongo: ServiceStatus;
    redis: ServiceStatus;
    uptimeSec: number;
}
