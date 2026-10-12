import crypto from 'node:crypto';
import type { BackupManifestDTO, BackupInspectionReport } from '@crm/types';
import { APP_VERSION } from '@crm/shared';

export const CURRENT_BACKUP_FORMAT_VERSION = '1.0.0';
export const CURRENT_SRM_VERSION = APP_VERSION;
export const CURRENT_SCHEMA_VERSION = 1;

export class BackupValidator {
  /**
   * Calculate SHA-256 of UTF-8 or raw Buffer
   */
  public calculateSha256(data: string | Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Validate Manifest Structure & Types
   */
  public validateManifest(manifest: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!manifest || typeof manifest !== 'object') {
      return { valid: false, errors: ['Manifest is missing or invalid object.'] };
    }

    if (!manifest.backupId || typeof manifest.backupId !== 'string') {
      errors.push('Manifest missing valid backupId.');
    }

    if (!manifest.createdAt || typeof manifest.createdAt !== 'string') {
      errors.push('Manifest missing valid createdAt timestamp.');
    }

    if (!manifest.backupFormatVersion || typeof manifest.backupFormatVersion !== 'string') {
      errors.push('Manifest missing backupFormatVersion.');
    }

    if (!manifest.tableCounts || typeof manifest.tableCounts !== 'object') {
      errors.push('Manifest missing valid tableCounts inventory.');
    }

    if (!manifest.checksumSha256 || typeof manifest.checksumSha256 !== 'string') {
      errors.push('Manifest missing overall checksumSha256.');
    }

    if (!manifest.componentChecksums || typeof manifest.componentChecksums !== 'object') {
      errors.push('Manifest missing componentChecksums.');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate Schema Compatibility
   */
  public validateSchemaCompatibility(manifest: BackupManifestDTO): { compatible: boolean; error?: string } {
    const backupSchemaVer = Number(manifest.databaseSchemaVersion) || 1;
    if (backupSchemaVer > CURRENT_SCHEMA_VERSION) {
      return {
        compatible: false,
        error: `Incompatible backup schema version (${backupSchemaVer}). Current system supports up to version ${CURRENT_SCHEMA_VERSION}.`,
      };
    }

    return { compatible: true };
  }

  /**
   * Deep Inspection and Checksum Verification of Package Content
   */
  public inspectPackage(packageData: {
    manifest: BackupManifestDTO;
    databaseJson: string;
    documentsJson?: string;
    configurationJson?: string;
    rawPayloadHash?: string;
  }): BackupInspectionReport {
    const validationErrors: string[] = [];
    const manifestCheck = this.validateManifest(packageData.manifest);

    if (!manifestCheck.valid) {
      return {
        manifest: null,
        isValid: false,
        integrityStatus: 'CORRUPTED',
        schemaCompatible: false,
        validationErrors: manifestCheck.errors,
      };
    }

    const manifest = packageData.manifest;

    // Check schema compatibility
    const schemaCheck = this.validateSchemaCompatibility(manifest);
    if (!schemaCheck.compatible && schemaCheck.error) {
      validationErrors.push(schemaCheck.error);
    }

    // Verify component checksums
    const dbHash = this.calculateSha256(packageData.databaseJson);
    if (dbHash !== manifest.componentChecksums.database) {
      validationErrors.push(`Database checksum mismatch: expected ${manifest.componentChecksums.database}, got ${dbHash}.`);
    }

    if (manifest.componentChecksums.documents && packageData.documentsJson) {
      const docsHash = this.calculateSha256(packageData.documentsJson);
      if (docsHash !== manifest.componentChecksums.documents) {
        validationErrors.push(`Documents checksum mismatch: expected ${manifest.componentChecksums.documents}, got ${docsHash}.`);
      }
    }

    const isValid = validationErrors.length === 0;
    const integrityStatus = isValid ? 'VALID' : 'CORRUPTED';

    return {
      manifest,
      isValid,
      integrityStatus,
      schemaCompatible: schemaCheck.compatible,
      validationErrors,
    };
  }
}

export const backupValidator = new BackupValidator();
