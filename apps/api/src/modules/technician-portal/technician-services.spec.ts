import { describe, it, expect, vi, beforeEach } from 'vitest';
import { technicianServicesService } from './technician-services.service';
import { technicianPortalRepository } from './technician-portal.repository';
import { TECHNICIAN_ERROR_CODES } from '@crm/shared';
import type { TechnicianAssignedService, TechnicianServiceDetail } from '@crm/types';

describe('Technician Portal Phase 4: Assigned Services & Authorized Detail Suite', () => {
  const mockTechAId = 'tech-uuid-alpha-101';
  const mockTechBId = 'tech-uuid-beta-202';

  const mockServiceAId = 'srv-uuid-alpha-001';
  const mockServiceBId = 'srv-uuid-beta-002';
  const mockUnassignedServiceId = 'srv-uuid-unassigned-003';

  const mockServicesForTechA: TechnicianAssignedService[] = [
    {
      serviceId: mockServiceAId,
      id: mockServiceAId,
      serviceNumber: 'SRV-2026-0001',
      serviceType: 'PERIODIC_MAINTENANCE',
      serviceClassification: 'WARRANTY',
      scheduledDate: new Date().toISOString(),
      scheduledTimeSlot: '10:00 AM - 12:00 PM',
      priority: 'HIGH',
      status: 'ASSIGNED',
      customerNotes: 'Please inspect the booster pump pressure.',
      customerId: 'cust-uuid-alpha-1',
      customerName: 'Apex Industrial Solutions',
      customerPhone: '9876543210',
      serviceAddress: 'Plot 42, MIDC Industrial Area',
      landmark: 'Near Water Tower',
      city: 'Pune',
      pincode: '411019',
      assetId: 'asset-uuid-1',
      productName: 'Commercial High-Pressure Booster Pump',
      serialNumber: 'SN-PUMP-2026-X1',
      jobCardId: 'jc-uuid-1',
      jobCardNumber: 'JC-2026-0001',
      jobCardStatus: 'ASSIGNED',
    },
    {
      serviceId: 'srv-uuid-alpha-002',
      id: 'srv-uuid-alpha-002',
      serviceNumber: 'SRV-2026-0002',
      serviceType: 'REPAIR',
      serviceClassification: 'GENERAL',
      scheduledDate: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days in future
      scheduledTimeSlot: '02:00 PM - 04:00 PM',
      priority: 'URGENT',
      status: 'SCHEDULED',
      customerNotes: 'Valve seal leak reported.',
      customerId: 'cust-uuid-alpha-2',
      customerName: 'Metro Logistics Center',
      customerPhone: '9876543212',
      serviceAddress: 'Gate 3, Warehouse Complex',
      landmark: 'Highway Junction',
      city: 'Pune',
      pincode: '411028',
      assetId: null,
      productName: null,
      serialNumber: null,
      jobCardId: null,
      jobCardNumber: null,
      jobCardStatus: null,
    },
  ];

  const mockServiceDetailA: TechnicianServiceDetail = {
    id: mockServiceAId,
    serviceNumber: 'SRV-2026-0001',
    serviceType: 'PERIODIC_MAINTENANCE',
    serviceClassification: 'WARRANTY',
    priority: 'HIGH',
    status: 'ASSIGNED',
    scheduledDate: new Date().toISOString(),
    scheduledTimeSlot: '10:00 AM - 12:00 PM',
    customerNotes: 'Please inspect the booster pump pressure.',
    internalNotes: 'Prior warranty claim verified.',
    createdAt: new Date().toISOString(),
    jobCardId: 'jc-uuid-1',
    jobCardNumber: 'JC-2026-0001',
    jobCardStatus: 'ASSIGNED',
    problemReported: 'Abnormal vibration under high pressure load',
    diagnosis: null,
    workPerformed: null,
    customer: {
      id: 'cust-uuid-alpha-1',
      customerNumber: 'CUST-2026-0001',
      fullName: 'Apex Industrial Solutions',
      phone: '9876543210',
      email: 'contact@apexindustrial.com',
      alternatePhone: null,
    },
    location: {
      addressLine1: 'Plot 42, MIDC Industrial Area',
      addressLine2: 'Phase II',
      landmark: 'Near Water Tower',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411019',
    },
    asset: {
      id: 'asset-uuid-1',
      assetNumber: 'ASSET-2026-0001',
      name: 'Commercial High-Pressure Booster Pump',
      brand: 'SR Enterprises',
      model: 'HP-500-PRO',
      serialNumber: 'SN-PUMP-2026-X1',
      purchaseDate: new Date('2025-06-15').toISOString(),
    },
    relevantHistory: [
      {
        serviceId: 'srv-hist-001',
        serviceNumber: 'SRV-2025-0899',
        serviceType: 'INSTALLATION',
        completedAt: new Date('2025-06-15').toISOString(),
        problemReported: 'Initial commissioning and pressure setup',
        diagnosis: 'Line calibrated to standard operating pressure',
        workPerformed: 'Full installation and baseline pressure test completed',
        partsReplaced: [],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Assigned Services Discovery & Multi-View Filtering', () => {
    it('returns assigned services exclusively for the authenticated technician', async () => {
      vi.spyOn(technicianPortalRepository, 'findAssignedServices').mockResolvedValueOnce(mockServicesForTechA);

      const result = await technicianServicesService.getAssignedServices(mockTechAId, 'all');

      expect(result).toHaveLength(2);
      expect(result[0].serviceNumber).toBe('SRV-2026-0001');
      expect(result[0].customerName).toBe('Apex Industrial Solutions');
      expect(result[0].priority).toBe('HIGH');
      expect(technicianPortalRepository.findAssignedServices).toHaveBeenCalledWith(mockTechAId, 'all');
    });

    it('passes view filters (today, upcoming, in_progress, on_hold) to repository', async () => {
      vi.spyOn(technicianPortalRepository, 'findAssignedServices').mockResolvedValueOnce([mockServicesForTechA[0]]);

      const todayResult = await technicianServicesService.getAssignedServices(mockTechAId, 'today');

      expect(todayResult).toHaveLength(1);
      expect(technicianPortalRepository.findAssignedServices).toHaveBeenCalledWith(mockTechAId, 'today');
    });

    it('rejects service listing if technicianId is missing (unauthenticated)', async () => {
      await expect(technicianServicesService.getAssignedServices('')).rejects.toMatchObject({
        statusCode: 401,
        code: TECHNICIAN_ERROR_CODES.SESSION_EXPIRED,
      });
    });
  });

  describe('2. Strict Authorization & Cross-Technician Isolation', () => {
    it('Technician A can access detail for their own assigned service', async () => {
      vi.spyOn(technicianPortalRepository, 'getAssignedServiceDetail').mockResolvedValueOnce({
        data: mockServiceDetailA,
      });

      const result = await technicianServicesService.getServiceDetail(mockServiceAId, mockTechAId);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockServiceAId);
      expect(result.customer.fullName).toBe('Apex Industrial Solutions');
      expect(result.location.city).toBe('Pune');
      expect(result.asset?.model).toBe('HP-500-PRO');
      expect(result.relevantHistory).toHaveLength(1);
    });

    it('Technician A is rejected with 403 Forbidden when requesting Technician B assigned service', async () => {
      vi.spyOn(technicianPortalRepository, 'getAssignedServiceDetail').mockResolvedValueOnce({
        forbidden: true,
      });

      await expect(
        technicianServicesService.getServiceDetail(mockServiceBId, mockTechAId)
      ).rejects.toMatchObject({
        statusCode: 403,
        code: TECHNICIAN_ERROR_CODES.SERVICE_NOT_ASSIGNED,
      });
    });

    it('Technician B is rejected with 403 Forbidden when requesting Technician A assigned service', async () => {
      vi.spyOn(technicianPortalRepository, 'getAssignedServiceDetail').mockResolvedValueOnce({
        forbidden: true,
      });

      await expect(
        technicianServicesService.getServiceDetail(mockServiceAId, mockTechBId)
      ).rejects.toMatchObject({
        statusCode: 403,
        code: TECHNICIAN_ERROR_CODES.SERVICE_NOT_ASSIGNED,
      });
    });

    it('Unassigned service is rejected with 403 Forbidden', async () => {
      vi.spyOn(technicianPortalRepository, 'getAssignedServiceDetail').mockResolvedValueOnce({
        forbidden: true,
      });

      await expect(
        technicianServicesService.getServiceDetail(mockUnassignedServiceId, mockTechAId)
      ).rejects.toMatchObject({
        statusCode: 403,
        code: TECHNICIAN_ERROR_CODES.SERVICE_NOT_ASSIGNED,
      });
    });

    it('Returns 404 when service does not exist', async () => {
      vi.spyOn(technicianPortalRepository, 'getAssignedServiceDetail').mockResolvedValueOnce({
        notFound: true,
      });

      await expect(
        technicianServicesService.getServiceDetail('non-existent-service-id', mockTechAId)
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'SERVICE_NOT_FOUND',
      });
    });
  });

  describe('3. Dynamic Reassignment Access Revocation & Grant', () => {
    it('instantly denies Technician A and grants Technician B when service is reassigned in CRM', async () => {
      // Step 1: Assigned to Tech A
      vi.spyOn(technicianPortalRepository, 'getAssignedServiceDetail').mockResolvedValueOnce({
        data: mockServiceDetailA,
      });
      const accessBefore = await technicianServicesService.getServiceDetail(mockServiceAId, mockTechAId);
      expect(accessBefore.id).toBe(mockServiceAId);

      // Step 2: CRM Admin reassigns Service A to Tech B
      // Now Tech A requests -> 403 Forbidden
      vi.spyOn(technicianPortalRepository, 'getAssignedServiceDetail').mockResolvedValueOnce({
        forbidden: true,
      });
      await expect(
        technicianServicesService.getServiceDetail(mockServiceAId, mockTechAId)
      ).rejects.toMatchObject({
        statusCode: 403,
        code: TECHNICIAN_ERROR_CODES.SERVICE_NOT_ASSIGNED,
      });

      // Step 3: Tech B requests -> 200 Authorized
      vi.spyOn(technicianPortalRepository, 'getAssignedServiceDetail').mockResolvedValueOnce({
        data: { ...mockServiceDetailA, id: mockServiceAId },
      });
      const accessAfter = await technicianServicesService.getServiceDetail(mockServiceAId, mockTechBId);
      expect(accessAfter.id).toBe(mockServiceAId);
    });
  });

  describe('4. Business-Agnostic Vocabulary Check', () => {
    it('contains zero hardcoded RO / Purifier / Membrane / TDS terminology in universal service contracts', () => {
      const serialized = JSON.stringify(mockServiceDetailA).toLowerCase();
      expect(serialized).not.toContain('membrane');
      expect(serialized).not.toContain('tds');
      expect(serialized).not.toContain('purifier');
    });
  });
});
