import { describe, it, expect } from 'vitest';
import { buildApp } from '../app.js';

describe('Dual PWA Architecture & Manifest Selection Integration Tests', () => {
  const app = buildApp();

  describe('Route-Aware SPA HTML Manifest Linkage', () => {
    it('GET / should serve Admin CRM HTML with Admin manifest and CRM title', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.headers['cache-control']).toBe('public, max-age=0, must-revalidate');

      const body = response.body;
      expect(body).toContain('href="/manifest-admin.webmanifest"');
      expect(body).toContain('<title id="app-title">Enterprises CRM</title>');
      expect(body).toContain('id="app-apple-title" content="CRM"');
      expect(body).toContain('id="app-name-meta" content="Enterprises CRM"');
      expect(body).toContain('id="app-apple-icon" href="/apple-touch-icon.png"');
    });

    it('GET /technician should serve Technician Portal HTML with Technician manifest', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/technician',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.headers['cache-control']).toBe('public, max-age=0, must-revalidate');

      const body = response.body;
      expect(body).toContain('href="/manifest-technician.webmanifest"');
      expect(body).toContain('<title id="app-title">Enterprises Technician</title>');
      expect(body).toContain('id="app-apple-title" content="Technician"');
      expect(body).toContain('id="app-name-meta" content="Enterprises Technician"');
      expect(body).toContain('id="app-apple-icon" href="/apple-touch-icon-technician.png"');
    });

    it('GET /technician/login should serve Technician Portal HTML with Technician manifest', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/technician/login',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');

      const body = response.body;
      expect(body).toContain('href="/manifest-technician.webmanifest"');
      expect(body).toContain('<title id="app-title">Enterprises Technician</title>');
      expect(body).toContain('id="app-apple-title" content="Technician"');
      expect(body).toContain('id="app-name-meta" content="Enterprises Technician"');
    });

    it('GET /technician/completed-services deep route should serve Technician manifest', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/technician/completed-services',
      });

      expect(response.statusCode).toBe(200);
      const body = response.body;
      expect(body).toContain('href="/manifest-technician.webmanifest"');
      expect(body).toContain('id="app-apple-title" content="Technician"');
    });

    it('GET /dashboard (Admin route) should serve Admin manifest', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/dashboard',
      });

      expect(response.statusCode).toBe(200);
      const body = response.body;
      expect(body).toContain('href="/manifest-admin.webmanifest"');
      expect(body).toContain('<title id="app-title">Enterprises CRM</title>');
    });
  });

  describe('Static Manifest Files & Distinct Identities', () => {
    it('GET /manifest-admin.webmanifest should return valid Admin CRM manifest with id /crm', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/manifest-admin.webmanifest',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('public, max-age=0, must-revalidate');

      const manifest = JSON.parse(response.body);
      expect(manifest.id).toBe('/crm');
      expect(manifest.name).toBe('Enterprises CRM');
      expect(manifest.short_name).toBe('CRM');
      expect(manifest.start_url).toBe('/');
      expect(manifest.scope).toBe('/');
      expect(manifest.display).toBe('standalone');
      expect(manifest.theme_color).toBe('#0B132B');
      expect(manifest.background_color).toBe('#0B132B');
      expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
    });

    it('GET /manifest-technician.webmanifest should return valid Technician manifest with id /technician', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/manifest-technician.webmanifest',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('public, max-age=0, must-revalidate');

      const manifest = JSON.parse(response.body);
      expect(manifest.id).toBe('/technician');
      expect(manifest.name).toBe('Enterprises Technician');
      expect(manifest.short_name).toBe('Technician');
      expect(manifest.start_url).toBe('/technician/');
      expect(manifest.scope).toBe('/technician/');
      expect(manifest.display).toBe('standalone');
      expect(manifest.theme_color).toBe('#0B132B');
      expect(manifest.background_color).toBe('#0B132B');
      expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
    });

    it('Admin and Technician manifests MUST have distinct IDs and Scopes', async () => {
      const [adminRes, techRes] = await Promise.all([
        app.inject({ method: 'GET', url: '/manifest-admin.webmanifest' }),
        app.inject({ method: 'GET', url: '/manifest-technician.webmanifest' }),
      ]);

      const adminManifest = JSON.parse(adminRes.body);
      const techManifest = JSON.parse(techRes.body);

      expect(adminManifest.id).not.toBe(techManifest.id);
      expect(adminManifest.scope).toBe('/');
      expect(techManifest.scope).toBe('/technician/');
      expect(adminManifest.start_url).toBe('/');
      expect(techManifest.start_url).toBe('/technician/');
    });
  });

  describe('Service Worker File Serving & Scope Separation', () => {
    it('GET /sw-admin.js should serve Admin service worker with revalidation header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/sw-admin.js',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('public, max-age=0, must-revalidate');
      expect(response.body).toContain('crm-admin-shell-v1');
      expect(response.body).toContain("url.pathname.startsWith('/technician')");
    });

    it('GET /sw-technician.js should serve Technician service worker with revalidation header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/sw-technician.js',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('public, max-age=0, must-revalidate');
      expect(response.body).toContain('crm-tech-shell-v1');
      expect(response.body).toContain('/manifest-technician.webmanifest');
    });
  });

  describe('PWA Icons Accessibility', () => {
    it('serves Admin CRM icons', async () => {
      const res192 = await app.inject({ method: 'GET', url: '/pwa-192x192.png' });
      const res512 = await app.inject({ method: 'GET', url: '/pwa-512x512.png' });

      expect(res192.statusCode).toBe(200);
      expect(res512.statusCode).toBe(200);
      expect(res192.headers['content-type']).toBe('image/png');
      expect(res512.headers['content-type']).toBe('image/png');
    });

    it('serves Technician Portal icons', async () => {
      const resTech192 = await app.inject({ method: 'GET', url: '/pwa-technician-192x192.png' });
      const resTech512 = await app.inject({ method: 'GET', url: '/pwa-technician-512x512.png' });

      expect(resTech192.statusCode).toBe(200);
      expect(resTech512.statusCode).toBe(200);
      expect(resTech192.headers['content-type']).toBe('image/png');
      expect(resTech512.headers['content-type']).toBe('image/png');
    });
  });
});
