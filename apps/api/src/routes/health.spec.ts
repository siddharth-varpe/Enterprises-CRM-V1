import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import * as dbHealthModule from '../database/health.js';
import * as redisHealthModule from '../redis/health.js';

describe('Health and Readiness Routes', () => {
  const app = buildApp();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /health should return 200 with ok status and environment metadata', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.status).toBe('ok');
    expect(json.environment).toBeDefined();
    expect(json.timestamp).toBeDefined();
    expect(json.version).toBe('1.2.0');
  });

  it('GET /ready should return 200 when database and redis are connected', async () => {
    vi.spyOn(dbHealthModule, 'checkDatabaseHealth').mockResolvedValue({
      status: 'connected',
      latencyMs: 5,
    });
    vi.spyOn(redisHealthModule, 'checkRedisHealth').mockResolvedValue({
      status: 'connected',
      latencyMs: 2,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/ready',
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.status).toBe('ready');
    expect(json.services.database).toBe('connected');
    expect(json.services.redis).toBe('connected');
  });

  it('GET /ready should return 503 when a service is disconnected', async () => {
    vi.spyOn(dbHealthModule, 'checkDatabaseHealth').mockResolvedValue({
      status: 'disconnected',
      latencyMs: 10,
    });
    vi.spyOn(redisHealthModule, 'checkRedisHealth').mockResolvedValue({
      status: 'connected',
      latencyMs: 2,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/ready',
    });

    expect(response.statusCode).toBe(503);
    const json = response.json();
    expect(json.status).toBe('not_ready');
    expect(json.services.database).toBe('disconnected');
  });

  it('GET /api/v1 should return 200 with API version info', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1',
    });

    expect(response.statusCode).toBe(200);
    const json = response.json();
    expect(json.success).toBe(true);
    expect(json.data.version).toBe('v1');
  });
});
