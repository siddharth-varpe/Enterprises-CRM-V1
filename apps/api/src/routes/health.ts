import type { FastifyPluginAsync } from 'fastify';
import type { HealthCheckResponse, ReadinessCheckResponse } from '@crm/types';
import { checkDatabaseHealth } from '../database/health.js';
import { checkRedisHealth } from '../redis/health.js';
import { env } from '../config/env.js';
import { APP_VERSION } from '@crm/shared';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * Liveness Probe: Process is alive and responding to HTTP
   */
  fastify.get('/health', async (_request, reply) => {
    const response: HealthCheckResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: env.NODE_ENV,
      version: APP_VERSION,
    };
    return reply.status(200).send(response);
  });

  /**
   * Readiness Probe: Validates connectivity to PostgreSQL and Redis
   */
  fastify.get('/ready', async (_request, reply) => {
    const [dbHealth, redisHealth] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
    ]);

    const isReady = dbHealth.status === 'connected' && redisHealth.status === 'connected';

    const response: ReadinessCheckResponse = {
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth.status,
        redis: redisHealth.status,
      },
    };

    const statusCode = isReady ? 200 : 503;
    return reply.status(statusCode).send(response);
  });
};
