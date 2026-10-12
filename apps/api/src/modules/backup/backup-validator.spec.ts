import { describe, it, expect } from 'vitest';
import { BackupValidator } from './backup-validator';
import type { BackupManifestDTO } from '@crm/types';

describe('BackupValidator Unit Tests', () => {
  const validator = new BackupValidator();

  const validManifest: BackupManifestDTO = {
    backupId: 'BACKUP-1234567890',
    createdAt: new Date().toISOString(),
    srmVersion: '1.2.0',
    databaseSchemaVersion: 1,
    backupFormatVersion: '1.0.0',
    backupType: 'FULL',
    tableCounts: { customers: 10, invoices: 5 },
    totalRecords: 15,
    documentCount: 2,
    documentStorageSizeBytes: 1024,
    databaseSizeBytes: 2048,
    totalPackageSizeBytes: 3072,
    checksumSha256: 'valid-package-hash',
    componentChecksums: {
      database: 'valid-db-hash',
      documents: 'valid-docs-hash',
    },
    status: 'COMPLETED',
  };

  it('validates a correct manifest structure', () => {
    const res = validator.validateManifest(validManifest);
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it('rejects manifest with missing required fields', () => {
    const invalidManifest = { ...validManifest, backupId: undefined as any };
    const res = validator.validateManifest(invalidManifest);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain('backupId');
  });

  it('validates schema compatibility correctly', () => {
    expect(validator.validateSchemaCompatibility(validManifest).compatible).toBe(true);

    const incompatibleManifest = { ...validManifest, databaseSchemaVersion: 999 };
    const check = validator.validateSchemaCompatibility(incompatibleManifest);
    expect(check.compatible).toBe(false);
    expect(check.error).toContain('Incompatible backup schema');
  });

  it('detects corrupted component checksums during package inspection', () => {
    const databaseJson = JSON.stringify({ customers: [] });
    const dbHash = validator.calculateSha256(databaseJson);

    const manifestWithWrongHash = {
      ...validManifest,
      componentChecksums: {
        database: 'tampered-hash',
        documents: 'valid-docs-hash',
      },
    };

    const inspection = validator.inspectPackage({
      manifest: manifestWithWrongHash,
      databaseJson,
    });

    expect(inspection.isValid).toBe(false);
    expect(inspection.integrityStatus).toBe('CORRUPTED');
    expect(inspection.validationErrors[0]).toContain('Database checksum mismatch');
  });
});
