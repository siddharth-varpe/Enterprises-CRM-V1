import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db, ensureDatabaseInitialized, closeDatabaseConnections } from '../../database/client';
import {
  technicians,
  technicianPortalAccess,
  customers,
  customerAssets,
  products,
  services,
  jobCards,
  invoices,
  payments,
} from '../../database/schema';
import { techniciansService } from './technicians.service';
import { randomUUID } from 'crypto';

describe('Technician Admin 360° Profile Integration Suite', () => {
  beforeAll(async () => {
    await ensureDatabaseInitialized();
  });

  afterAll(async () => {
    await closeDatabaseConnections();
  });

  it('TEST 1: should return 404 error when technician does not exist', async () => {
    const nonExistentId = randomUUID();
    await expect(techniciansService.getTechnician360Profile(nonExistentId)).rejects.toThrow(
      'Technician not found'
    );
  });

  it('TEST 2: should assemble complete 360 profile for technician with live CRM services, job cards, parts and payments', async () => {
    const techId = randomUUID();
    const customerId = randomUUID();
    const productId = randomUUID();
    const assetId = randomUUID();
    const service1Id = randomUUID();
    const service2Id = randomUUID();
    const jobCard1Id = randomUUID();
    const jobCard2Id = randomUUID();
    const invoiceId = randomUUID();
    const paymentId = randomUUID();

    const techPhone = `9833${Math.floor(100000 + Math.random() * 900000)}`;
    const custPhone = `9844${Math.floor(100000 + Math.random() * 900000)}`;

    // 1. Create Technician with Portal Access
    await db.insert(technicians).values({
      id: techId,
      fullName: 'Vikram Shinde',
      phone: techPhone,
      email: `vikram.${Date.now()}@srenterprises.com`,
      status: 'ACTIVE',
      skills: ['RO Installation', 'Filter Replacement'],
      address: 'Shop 4, Market Yard, Pune',
      emergencyContact: '9899001122',
    });

    await db.insert(technicianPortalAccess).values({
      technicianId: techId,
      portalEnabled: true,
    });

    // 2. Create Customer & Asset
    await db.insert(customers).values({
      id: customerId,
      customerNumber: `CUST-360-${Date.now()}`,
      fullName: 'Ananya Sharma',
      phone: custPhone,
      email: 'ananya@example.com',
      status: 'ACTIVE',
    });

    await db.insert(products).values({
      id: productId,
      name: 'AquaGuard Magna RO',
      sku: `SKU-${Date.now()}`,
        productType: 'RO_MACHINE',
      brand: 'AquaGuard',
      unitPrice: '15000.00',
    });

    await db.insert(customerAssets).values({
      id: assetId,
      assetNumber: `AST-${Date.now()}`,
      customerId,
      productId,
      assetType: 'RO_MACHINE',
      customName: 'Office RO Purifier',
      serialNumber: 'SN-MAGNA-2026',
      purchaseDate: new Date(),
      status: 'ACTIVE',
    });

    // 3. Service 1: Completed Service with Job Card, Parts, Invoice and Payment
    const now = new Date();
    await db.insert(services).values({
      id: service1Id,
      serviceNumber: `SRV-360-1-${Date.now()}`,
      customerId,
      assetId,
      technicianId: techId,
      serviceType: 'PERIODIC_MAINTENANCE',
      scheduledDate: new Date(now.getTime() - 24 * 60 * 60 * 1000), // yesterday
      status: 'COMPLETED',
      priority: 'NORMAL',
      customerNotes: 'Filter change required',
      completedAt: new Date(now.getTime() - 20 * 60 * 60 * 1000),
    });

    await db.insert(jobCards).values({
      id: jobCard1Id,
      jobCardNumber: `JC-360-1-${Date.now()}`,
      serviceId: service1Id,
      customerId,
      assetId,
      technicianId: techId,
      problemReported: 'Low water flow',
      diagnosis: 'Sediment filter clogged',
      workPerformed: 'Replaced sediment filter and sanitized chamber',
      partsReplaced: [
        {
          partName: 'Sediment Filter Cartridge',
          partSku: 'SKU-SED-10',
          quantity: 1,
          isWarrantyCovered: false,
          price: 450,
        },
      ],
      laborCharges: '300.00',
      partsCharges: '450.00',
      totalCharges: '750.00',
      startedAt: new Date(now.getTime() - 22 * 60 * 60 * 1000),
      completedAt: new Date(now.getTime() - 20 * 60 * 60 * 1000),
      status: 'COMPLETED',
    });

    // Linked Invoice & Payment
    await db.insert(invoices).values({
      id: invoiceId,
      invoiceNumber: `INV-360-${Date.now()}`,
      customerId,
      serviceId: service1Id,
      jobCardId: jobCard1Id,
      invoiceDate: new Date(),
      dueDate: new Date(),
      subtotal: '750.00',
      totalAmount: '750.00',
      status: 'PAID',
    });

    await db.insert(payments).values({
      id: paymentId,
      paymentNumber: `PAY-360-${Date.now()}`,
      customerId,
      invoiceId,
      amount: '750.00',
      paymentDate: new Date(),
      paymentMethod: 'UPI',
      status: 'COMPLETED',
      referenceNumber: 'UPI-UTR-998877',
    });

    // 4. Service 2: In-Progress / Scheduled Service
    await db.insert(services).values({
      id: service2Id,
      serviceNumber: `SRV-360-2-${Date.now()}`,
      customerId,
      assetId,
      technicianId: techId,
      serviceType: 'REPAIR',
      scheduledDate: new Date(now.getTime() + 24 * 60 * 60 * 1000), // tomorrow
      status: 'SCHEDULED',
      priority: 'HIGH',
      customerNotes: 'Machine making buzzing noise',
    });

    await db.insert(jobCards).values({
      id: jobCard2Id,
      jobCardNumber: `JC-360-2-${Date.now()}`,
      serviceId: service2Id,
      customerId,
      assetId,
      technicianId: techId,
      problemReported: 'Buzzing noise',
      laborCharges: '0.00',
      partsCharges: '0.00',
      totalCharges: '0.00',
      status: 'SCHEDULED',
    });

    // 5. Query 360 Profile through service
    const profile = await techniciansService.getTechnician360Profile(techId);

    // Verify Identity
    expect(profile.technician.id).toBe(techId);
    expect(profile.technician.fullName).toBe('Vikram Shinde');
    expect(profile.technician.phone).toBe(techPhone);
    expect(profile.technician.portalEnabled).toBe(true);
    expect(profile.technician.status).toBe('ACTIVE');
    expect(profile.technician.skills).toContain('RO Installation');

    // Verify Work Summary
    expect(profile.workSummary.completedCount).toBeGreaterThanOrEqual(1);
    expect(profile.workSummary.completionRate).toBeGreaterThan(0);

    // Verify Services & Job Cards
    expect(profile.assignedServices.length).toBeGreaterThanOrEqual(2);
    expect(profile.assignedServices.some((s) => s.id === service1Id)).toBe(true);
    expect(profile.assignedServices.some((s) => s.id === service2Id)).toBe(true);

    expect(profile.jobCards.length).toBeGreaterThanOrEqual(2);
    const jc1 = profile.jobCards.find((j) => j.id === jobCard1Id);
    expect(jc1).toBeDefined();
    expect(jc1?.workPerformed).toBe('Replaced sediment filter and sanitized chamber');
    expect(jc1?.totalCharges).toBe('750.00');

    // Verify Completed Services
    expect(profile.completedServices.some((s) => s.id === service1Id)).toBe(true);

    // Verify Parts Used
    expect(profile.partsUsed.length).toBeGreaterThanOrEqual(1);
    expect(profile.partsUsed.some((p) => p.partName === 'Sediment Filter Cartridge')).toBe(true);

    // Verify Customers Handled
    expect(profile.customersHandled.some((c) => c.customerId === customerId)).toBe(true);

    // Verify Assets Handled
    expect(profile.assetsHandled.some((a) => a.assetId === assetId)).toBe(true);

    // Verify Financials & Payments
    expect(profile.financialSummary.totalInvoiced).toBeGreaterThanOrEqual(750);
    expect(profile.financialSummary.totalCollected).toBeGreaterThanOrEqual(750);
    expect(profile.payments.some((p) => p.paymentNumber.startsWith('PAY-360'))).toBe(true);
  });

  it('TEST 3: should handle empty state cleanly for technician with zero services or assignments', async () => {
    const techId = randomUUID();
    const phone = `9855${Math.floor(100000 + Math.random() * 900000)}`;

    await db.insert(technicians).values({
      id: techId,
      fullName: 'New Trainee Tech',
      phone,
      email: 'trainee@srenterprises.com',
      status: 'ACTIVE',
      skills: ['General Trainee'],
    });

    const profile = await techniciansService.getTechnician360Profile(techId);

    expect(profile.technician.id).toBe(techId);
    expect(profile.technician.fullName).toBe('New Trainee Tech');
    expect(profile.technician.portalEnabled).toBe(false);

    // Zero work summary
    expect(profile.workSummary.assignedCount).toBe(0);
    expect(profile.workSummary.completedCount).toBe(0);
    expect(profile.workSummary.currentWorkload).toBe(0);
    expect(profile.workSummary.completionRate).toBe(0);
    expect(profile.workSummary.isAverageCompletionTimeReliable).toBe(false);

    // Zero collections
    expect(profile.financialSummary.totalInvoiced).toBe(0);
    expect(profile.financialSummary.totalCollected).toBe(0);
    expect(profile.financialSummary.pendingBalance).toBe(0);

    // Empty arrays
    expect(profile.assignedServices).toEqual([]);
    expect(profile.completedServices).toEqual([]);
    expect(profile.currentWork).toEqual([]);
    expect(profile.upcomingWork).toEqual([]);
    expect(profile.jobCards).toEqual([]);
    expect(profile.customersHandled).toEqual([]);
    expect(profile.assetsHandled).toEqual([]);
    expect(profile.partsUsed).toEqual([]);
    expect(profile.payments).toEqual([]);
  });

  it('TEST 4: multi-technician data isolation: Technician A work records never leak into Technician B profile', async () => {
    const techAId = randomUUID();
    const techBId = randomUUID();
    const customerId = randomUUID();
    const assetId = randomUUID();
    const serviceAId = randomUUID();
    const serviceBId = randomUUID();

    // Create 2 distinct technicians
    await db.insert(technicians).values([
      {
        id: techAId,
        fullName: 'Technician Alpha',
        phone: `9866${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'ACTIVE',
      },
      {
        id: techBId,
        fullName: 'Technician Beta',
        phone: `9877${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'ACTIVE',
      },
    ]);

    // Create Customer & Asset
    await db.insert(customers).values({
      id: customerId,
      customerNumber: `CUST-ISO-${Date.now()}`,
      fullName: 'Isolation Test Customer',
      phone: `9888${Math.floor(100000 + Math.random() * 900000)}`,
      status: 'ACTIVE',
    });

    const [prod] = await db
      .insert(products)
      .values({
        id: randomUUID(),
        name: 'Standard RO Unit',
        sku: `SKU-ISO-${Date.now()}`,
          productType: 'RO_MACHINE',
        brand: 'Standard',
        unitPrice: '8000.00',
      })
      .returning();

    await db.insert(customerAssets).values({
      id: assetId,
      assetNumber: `AST-ISO-${Date.now()}`,
      customerId,
      productId: prod.id,
      assetType: 'RO_MACHINE',
      status: 'ACTIVE',
      purchaseDate: new Date(),
    });

    // Assign Service A to Tech A only
    await db.insert(services).values({
      id: serviceAId,
      serviceNumber: `SRV-ALPHA-${Date.now()}`,
      customerId,
      assetId,
      technicianId: techAId,
      serviceType: 'INSTALLATION',
      scheduledDate: new Date(),
      status: 'SCHEDULED',
    });

    // Assign Service B to Tech B only
    await db.insert(services).values({
      id: serviceBId,
      serviceNumber: `SRV-BETA-${Date.now()}`,
      customerId,
      assetId,
      technicianId: techBId,
      serviceType: 'REPAIR',
      scheduledDate: new Date(),
      status: 'SCHEDULED',
    });

    // Fetch both profiles
    const profileA = await techniciansService.getTechnician360Profile(techAId);
    const profileB = await techniciansService.getTechnician360Profile(techBId);

    // Verify Tech A only sees Service A
    expect(profileA.assignedServices.some((s) => s.id === serviceAId)).toBe(true);
    expect(profileA.assignedServices.some((s) => s.id === serviceBId)).toBe(false);

    // Verify Tech B only sees Service B
    expect(profileB.assignedServices.some((s) => s.id === serviceBId)).toBe(true);
    expect(profileB.assignedServices.some((s) => s.id === serviceAId)).toBe(false);
  });
});
