import { describe, it, expect, beforeEach } from 'vitest';
import { jobCardsRepository, memoryJobCards } from '../job-cards/job-cards.repository';
import { servicesRepository, memoryServices } from '../services/services.repository';

describe('Admin & Technician Hold Status Synchronization', () => {
  const mockTechId = '11111111-2222-3333-4444-555555555555';
  const mockServiceId = '22222222-3333-4444-5555-666666666666';
  const mockJobCardId = '33333333-4444-5555-6666-777777777777';

  beforeEach(() => {
    // Clear / reset memory lists for this mock
    const sIndex = memoryServices.findIndex((s) => s.id === mockServiceId);
    if (sIndex >= 0) memoryServices.splice(sIndex, 1);

    const jIndex = memoryJobCards.findIndex((j) => j.id === mockJobCardId);
    if (jIndex >= 0) memoryJobCards.splice(jIndex, 1);

    memoryServices.push({
      id: mockServiceId,
      serviceNumber: 'SRV-TEST-HOLD-001',
      serviceType: 'REPAIR',
      serviceLocation: 'DOORSTEP',
      serviceClassification: 'GENERAL',
      scheduledDate: new Date().toISOString(),
      status: 'IN_PROGRESS',
      priority: 'NORMAL',
      customerId: '44444444-5555-6666-7777-888888888888',
      customerName: 'Test Hold Customer',
      customerPhone: '9876543210',
      technicianId: mockTechId,
      technicianName: 'Test Tech',
      technicianPhone: '9123456780',
      jobCardId: mockJobCardId,
      jobCardNumber: 'JC-TEST-HOLD-001',
      jobCardStatus: 'IN_PROGRESS',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    memoryJobCards.push({
      id: mockJobCardId,
      jobCardNumber: 'JC-TEST-HOLD-001',
      serviceId: mockServiceId,
      customerId: '44444444-5555-6666-7777-888888888888',
      technicianId: mockTechId,
      status: 'IN_PROGRESS',
      problemReported: 'RO Filter leakage',
      technicianNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it('updates both job card and linked service status to ON_HOLD when action is hold', async () => {
    const updatedJob = await jobCardsRepository.performWorkflowAction(
      mockJobCardId,
      {
        action: 'hold',
        reason: 'Customer requested 5pm visit due to power outage',
      } as any,
      mockTechId
    );

    expect(updatedJob.status).toBe('ON_HOLD');
    expect(updatedJob.technicianNotes).toContain('[Hold reason]: Customer requested 5pm visit due to power outage');

    // Verify service in servicesRepository is also ON_HOLD
    const service = await servicesRepository.findById(mockServiceId);
    expect(service).toBeDefined();
    expect(service?.status).toBe('ON_HOLD');
  });

  it('restores service status to IN_PROGRESS when action is resume', async () => {
    // First hold
    await jobCardsRepository.performWorkflowAction(
      mockJobCardId,
      { action: 'hold', reason: 'Waiting for parts' } as any,
      mockTechId
    );

    // Then resume
    const resumed = await jobCardsRepository.performWorkflowAction(
      mockJobCardId,
      { action: 'resume' },
      mockTechId
    );

    expect(resumed.status).toBe('IN_PROGRESS');

    const service = await servicesRepository.findById(mockServiceId);
    expect(service?.status).toBe('IN_PROGRESS');
  });

  it('exposes jobCardTechnicianNotes and ON_HOLD status on service', async () => {
    await jobCardsRepository.performWorkflowAction(
      mockJobCardId,
      { action: 'hold', reason: 'Waiting for RO booster pump arrival' } as any,
      mockTechId
    );

    const target = await servicesRepository.findById(mockServiceId);

    expect(target).toBeDefined();
    expect(target?.status).toBe('ON_HOLD');
    expect(target?.jobCardStatus).toBe('ON_HOLD');
    expect((target as any)?.jobCardTechnicianNotes).toContain('Waiting for RO booster pump arrival');
  });
});
