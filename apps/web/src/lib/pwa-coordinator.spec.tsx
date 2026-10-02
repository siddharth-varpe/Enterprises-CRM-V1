import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, act } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { PwaCoordinator, usePwaInstallPrompt } from './pwa-coordinator';

describe('PwaCoordinator Unit Tests', () => {
  const originalServiceWorker = navigator.serviceWorker;
  let registerMock: any;

  beforeEach(() => {
    registerMock = vi.fn().mockResolvedValue({
      update: vi.fn().mockResolvedValue(undefined),
    });

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: registerMock,
      },
      writable: true,
      configurable: true,
    });

    // Populate mock DOM head elements matching index.html
    document.head.innerHTML = `
      <link id="app-manifest" rel="manifest" href="/manifest-admin.webmanifest" />
      <meta id="app-apple-title" name="apple-mobile-web-app-title" content="CRM" />
      <meta id="app-name-meta" name="application-name" content="Enterprises CRM" />
      <link id="app-apple-icon" rel="apple-touch-icon" href="/apple-touch-icon.png" />
      <title id="app-title">Enterprises CRM</title>
    `;
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: originalServiceWorker,
      writable: true,
      configurable: true,
    });
    document.head.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('keeps Admin manifest and registers /sw-admin.js on Admin routes', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <PwaCoordinator>
          <div>Admin Content</div>
        </PwaCoordinator>
      </MemoryRouter>
    );

    const manifestEl = document.getElementById('app-manifest') as HTMLLinkElement;
    expect(manifestEl.getAttribute('href')).toBe('/manifest-admin.webmanifest');

    const appleTitle = document.getElementById('app-apple-title') as HTMLMetaElement;
    expect(appleTitle.getAttribute('content')).toBe('CRM');

    expect(registerMock).toHaveBeenCalledWith('/sw-admin.js', { scope: '/' });
  });

  it('switches to Technician manifest and registers /sw-technician.js on /technician/login', () => {
    render(
      <MemoryRouter initialEntries={['/technician/login']}>
        <PwaCoordinator>
          <div>Technician Login</div>
        </PwaCoordinator>
      </MemoryRouter>
    );

    const manifestEl = document.getElementById('app-manifest') as HTMLLinkElement;
    expect(manifestEl.getAttribute('href')).toBe('/manifest-technician.webmanifest');

    const appleTitle = document.getElementById('app-apple-title') as HTMLMetaElement;
    expect(appleTitle.getAttribute('content')).toBe('Technician');

    const appName = document.getElementById('app-name-meta') as HTMLMetaElement;
    expect(appName.getAttribute('content')).toBe('Enterprises Technician');

    const appleIcon = document.getElementById('app-apple-icon') as HTMLLinkElement;
    expect(appleIcon.getAttribute('href')).toBe('/apple-touch-icon-technician.png');

    expect(registerMock).toHaveBeenCalledWith('/sw-technician.js', { scope: '/technician/' });
  });

  it('dynamically switches manifests during client-side navigation between Admin and Technician', async () => {
    let navigateFn: any;

    const NavigationConsumer = () => {
      navigateFn = useNavigate();
      const pwa = usePwaInstallPrompt();
      return (
        <div>
          <span data-testid="app-name">{pwa.appName}</span>
          <span data-testid="app-type">{pwa.appType}</span>
        </div>
      );
    };

    const { getByTestId } = render(
      <MemoryRouter initialEntries={['/']}>
        <PwaCoordinator>
          <NavigationConsumer />
        </PwaCoordinator>
      </MemoryRouter>
    );

    expect(getByTestId('app-name').textContent).toBe('Enterprises CRM');
    expect(getByTestId('app-type').textContent).toBe('admin');

    const manifestEl = document.getElementById('app-manifest') as HTMLLinkElement;
    expect(manifestEl.getAttribute('href')).toBe('/manifest-admin.webmanifest');

    // Client-side navigate to technician portal
    await act(async () => {
      navigateFn('/technician/services');
    });

    expect(getByTestId('app-name').textContent).toBe('Enterprises Technician');
    expect(getByTestId('app-type').textContent).toBe('technician');
    expect(manifestEl.getAttribute('href')).toBe('/manifest-technician.webmanifest');

    // Client-side navigate back to admin CRM
    await act(async () => {
      navigateFn('/customers');
    });

    expect(getByTestId('app-name').textContent).toBe('Enterprises CRM');
    expect(getByTestId('app-type').textContent).toBe('admin');
    expect(manifestEl.getAttribute('href')).toBe('/manifest-admin.webmanifest');
  });
});
