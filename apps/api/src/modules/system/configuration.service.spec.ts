import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigurationService, SYSTEM_DEFAULTS } from './configuration.service';
import type { SettingsCategory, BusinessSettings, TaxSettings, SystemSettings } from '@crm/types';

vi.mock('../../database/client', () => ({
  db: {
    query: {
      appSettings: {
        findFirst: vi.fn(),
      },
    },
    transaction: vi.fn(async (cb) => {
      const mockTx = {
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            onConflictDoUpdate: vi.fn().mockResolvedValue([{}]),
          })),
        })),
      };
      return cb(mockTx);
    }),
  },
}));

describe('Phase 27: Central ConfigurationService — Unit Tests', () => {
  let service: ConfigurationService;

  beforeEach(() => {
    service = new ConfigurationService();
    service.clearCache();
    vi.clearAllMocks();
  });

  describe('1. Defaults Resolution for All 13 Categories', () => {
    const categories: SettingsCategory[] = [
      'SYSTEM',
      'BUSINESS',
      'TAX',
      'INVOICE',
      'PAYMENT',
      'SALES',
      'SERVICE',
      'JOB_CARD',
      'WARRANTY',
      'INVENTORY',
      'NOTIFICATION',
      'NUMBERING',
      'SECURITY',
    ];

    it('should return system default values for all categories when database is empty', async () => {
      for (const cat of categories) {
        const config = await service.get(cat);
        expect(config).toBeDefined();
        expect(config).toEqual(SYSTEM_DEFAULTS[cat]);
      }
    });

    it('should resolve a specific sub-key using getSetting', async () => {
      const taxRate = await service.getSetting<number>('TAX', 'defaultTaxRatePercent');
      expect(taxRate).toBe(18.00);

      const appName = await service.getSetting<string>('SYSTEM', 'appName');
      expect(appName).toContain('Enterprises CRM');
    });
  });

  describe('2. In-Memory Caching & Cache Invalidation', () => {
    it('should cache settings after initial load', async () => {
      const first = await service.get<TaxSettings>('TAX');
      expect(first.defaultTaxRatePercent).toBe(18);

      // Mutate local cache and read again
      const second = await service.get<TaxSettings>('TAX');
      expect(second).toBe(first);
    });

    it('should invalidate cache when clearCache is called', async () => {
      const first = await service.get<TaxSettings>('TAX');
      service.clearCache('TAX');
      const second = await service.get<TaxSettings>('TAX');
      expect(second).toEqual(first);
      expect(second).not.toBe(first); // New object returned
    });
  });

  describe('3. Validation & Constraint Enforcement', () => {
    it('should reject invalid phone format in BUSINESS settings', async () => {
      await expect(
        service.update<BusinessSettings>('BUSINESS', { phone: '123' } as any)
      ).rejects.toThrow(/Phone must be a valid 10-digit number/);
    });

    it('should reject invalid GSTIN format in BUSINESS settings', async () => {
      await expect(
        service.update<BusinessSettings>('BUSINESS', { gstin: 'INVALID_GSTIN_123' } as any)
      ).rejects.toThrow(/Invalid GSTIN format/);
    });

    it('should reject invalid postal code format in BUSINESS settings', async () => {
      await expect(
        service.update<BusinessSettings>('BUSINESS', { postalCode: '411' } as any)
      ).rejects.toThrow(/Postal code must be 6 digits/);
    });

    it('should reject negative tax rate in TAX settings', async () => {
      await expect(
        service.update<TaxSettings>('TAX', { defaultTaxRatePercent: -5 } as any)
      ).rejects.toThrow(/Invalid TAX settings/);
    });

    it('should reject tax rate over 100%', async () => {
      await expect(
        service.update<TaxSettings>('TAX', { defaultTaxRatePercent: 150 } as any)
      ).rejects.toThrow(/Invalid TAX settings/);
    });
  });

  describe('4. Optimistic Concurrency Protection', () => {
    it('should reject update if expectedVersion does not match current version', async () => {
      await expect(
        service.update('TAX', { defaultTaxRatePercent: 20 }, 99, 'user-1', 'Admin')
      ).rejects.toThrow(/Configuration conflict!/);
    });
  });

  describe('5. Secret Isolation & Public Sanitization', () => {
    it('should return safe public settings without exposing any secrets', async () => {
      const publicSettings = await service.getPublicSettings();
      expect(publicSettings).toHaveProperty('appName');
      expect(publicSettings).toHaveProperty('businessName');
      expect(publicSettings).toHaveProperty('currencySymbol');
      expect(publicSettings).not.toHaveProperty('DATABASE_URL');
      expect(publicSettings).not.toHaveProperty('JWT_SECRET');
      expect(publicSettings).not.toHaveProperty('ENCRYPTION_KEY');
      expect(publicSettings).not.toHaveProperty('APP_SECRET');
    });
  });

  describe('6. Configuration Health Assessment', () => {
    it('should report healthy when all categories contain valid configurations', async () => {
      const health = await service.validateHealth();
      expect(health.healthy).toBe(true);
      expect(health.issues).toHaveLength(0);
      expect(health.categories.TAX).toBe(true);
      expect(health.categories.BUSINESS).toBe(true);
      expect(health.categories.INVOICE).toBe(true);
    });
  });
});
