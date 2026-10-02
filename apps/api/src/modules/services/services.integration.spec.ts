import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db, ensureDatabaseInitialized, closeDatabaseConnections } from '../../database/client';
import { servicesRepository } from './services.repository';
import { emailService } from '../notifications/email.service';
import { emailScheduler } from '../notifications/email-scheduler';
import { customers, customerAssets, products, services, jobCards, technicians } from '../../database/schema/index';
import { eq, sql } from 'drizzle-orm';

describe('Services Scheduling & Reminder Integration Tests', () => {
  beforeAll(async () => {
    await ensureDatabaseInitialized();
    const { seedInitialSystemData } = await import('../../database/seeds/initial');
    await seedInitialSystemData();
  });

  afterAll(async () => {
    await closeDatabaseConnections();
  });
  it('TEST 1: should schedule a new service visit and persist to database', async () => {
    // 1. Ensure active customer exists
    let [testCust] = await db.select().from(customers).limit(1);
    if (!testCust) {
      const [newCust] = await db.insert(customers).values({
        customerNumber: `CUST-${Date.now() % 10000}`,
        fullName: 'Rajesh Kumar Test',
        phone: '9820012345',
        email: 'rajesh.kumar@example.com',
        status: 'ACTIVE',
      }).returning();
      testCust = newCust;
    }
    expect(testCust).toBeDefined();

    // 2. Ensure customer machine exists
    let [testAsset] = await db.select().from(customerAssets).where(eq(customerAssets.customerId, testCust.id)).limit(1);
    if (!testAsset) {
      let [prod] = await db.select().from(products).limit(1);
      if (!prod) {
        const [newP] = await db.insert(products).values({
          name: 'Commercial RO System 50 LPH',
          sku: `AP-RO-${Date.now()}`,
          productType: 'RO_MACHINE',
          brand: 'AquaPure',
          model: 'AP-50C',
          unitPrice: '20000',
          isActive: true,
        }).returning();
        prod = newP;
      }

      const [newAst] = await db.insert(customerAssets).values({
        assetNumber: `AST-${Date.now() % 10000}`,
        customerId: testCust.id,
        productId: prod.id,
        customName: 'Office RO Purifier',
        serialNumber: 'SR-RO-998811',
        assetType: 'RO_MACHINE',
        purchaseDate: new Date(),
        status: 'ACTIVE',
      }).returning();
      testAsset = newAst;
    }
    expect(testAsset).toBeDefined();

    // 3. Get technician
    let techs = await servicesRepository.listTechnicians();
    if (techs.length === 0) {
      const [newTech] = await db.insert(technicians).values({
        fullName: 'Rohan Shinde',
        phone: '9822334455',
        email: 'rohan.shinde@srenterprises.com',
        status: 'ACTIVE',
      }).returning();
      techs = [newTech];
    }
    expect(techs.length).toBeGreaterThan(0);
    const tech = techs[0];

    // 4. Confirm & Schedule Service Visit
    const now = new Date();
    const visitDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-08`;
    const schedulePayload = {
      customerId: testCust.id,
      assetId: testAsset.id,
      serviceType: 'REPAIR' as const,
      serviceLocation: 'DOORSTEP' as const,
      serviceClassification: 'WARRANTY' as const,
      scheduledDate: visitDate,
      scheduledTimeSlot: '10:00 AM - 12:00 PM',
      priority: 'NORMAL' as const,
      technicianId: tech.id,
      customerNotes: 'Low flow and vibration in water pump',
      internalNotes: 'Replace sediment filter and check pressure valve',
    };

    const result = await servicesRepository.createService(schedulePayload);
    expect(result).toBeDefined();
    expect(result.service.id).toBeDefined();
    expect(result.service.serviceNumber).toMatch(/^SRV-\d{4}-\d+/);
    expect(result.service.status).toBe('ASSIGNED');
    expect(result.jobCard.jobCardNumber).toMatch(/^JC-\d{4}-\d+/);

    // 5. TEST 2 & 3: Verify Persistence in DB
    const [persisted] = await db.select().from(services).where(eq(services.id, result.service.id));
    expect(persisted).toBeDefined();
    expect(persisted.serviceNumber).toBe(result.service.serviceNumber);
    expect(persisted.customerId).toBe(testCust.id);
    expect(persisted.assetId).toBe(testAsset.id);

    // 6. TEST 4: Query through findPaginated (Services table)
    const paginated = await servicesRepository.findPaginated({ page: 1, limit: 50 });
    const serviceInTable = paginated.data.find((s: any) => s.id === result.service.id);
    expect(serviceInTable).toBeDefined();
    expect(serviceInTable.customerName).toBe(testCust.fullName);
    expect(serviceInTable.productName).toBeDefined();
    expect(serviceInTable.status).toBe('ASSIGNED');

    // 7. TEST 5: Query through findById (Service Detail)
    const detail = await servicesRepository.findById(result.service.id);
    expect(detail).toBeDefined();
    expect(detail?.customerPhone).toBe(testCust.phone);
    expect(detail?.technicianName).toBe(tech.fullName);
    expect(detail?.jobCardNumber).toBe(result.jobCard.jobCardNumber);

    // 8. TEST 6: Heatmap / Calendar verification
    const heatmap = await servicesRepository.getHeatmapData('month');
    const dayEntry = heatmap.dailyData.find((d: any) => d.date_str === visitDate);
    expect(dayEntry).toBeDefined();
    expect(dayEntry?.count).toBeGreaterThan(0);
    expect(dayEntry?.warranty_count).toBeGreaterThan(0);
  });

  it('TEST 7: should auto-provision an active machine asset when customer has no assets', async () => {
    const [newCust] = await db.insert(customers).values({
      customerNumber: `CUST-AUTO-${Date.now() % 10000}`,
      fullName: 'Aarav Patel Test',
      phone: '9844001122',
      email: 'aarav.patel@example.com',
      status: 'ACTIVE',
    }).returning();

    const result = await servicesRepository.createService({
      customerId: newCust.id,
      serviceType: 'INSTALLATION',
      serviceLocation: 'DOORSTEP',
      serviceClassification: 'GENERAL',
      scheduledDate: '2026-09-12',
      scheduledTimeSlot: '02:00 PM - 04:00 PM',
      priority: 'HIGH',
      customerNotes: 'New installation in kitchen area',
    });

    expect(result.service.id).toBeDefined();
    expect(result.service.assetId).toBeDefined();

    // Verify auto-provisioned machine in DB
    const [assetInDb] = await db.select().from(customerAssets).where(eq(customerAssets.id, result.service.assetId));
    expect(assetInDb).toBeDefined();
    expect(assetInDb.customerId).toBe(newCust.id);
    expect(assetInDb.productId).toBeDefined();
  });

  it('TEST 8 & 9: should generate service reminder with machine details and prevent duplicate dispatches', async () => {
    let [testCust] = await db.select().from(customers).where(sql`email IS NOT NULL AND email != ''`).limit(1);
    if (!testCust) {
      const [newCust] = await db.insert(customers).values({
        customerNumber: `CUST-REM-${Date.now() % 10000}`,
        fullName: 'Vikram Test',
        phone: '9820099999',
        email: `vikram.${Date.now()}@example.com`,
        status: 'ACTIVE',
      }).returning();
      testCust = newCust;
    }
    let [testAsset] = await db.select().from(customerAssets).where(eq(customerAssets.customerId, testCust.id)).limit(1);
    if (!testAsset) {
      let [prod] = await db.select().from(products).limit(1);
      if (!prod) {
        const [newP] = await db.insert(products).values({
          name: 'Commercial RO System 50 LPH',
          sku: `AP-RO-${Date.now()}`,
          category: 'WATER_PURIFIER',
          productType: 'WATER_PURIFIER',
          brand: 'AquaPure',
          model: 'AP-50C',
          unitPrice: '20000',
          mrp: '24000',
          stockQuantity: 10,
          isActive: true,
        }).returning();
        prod = newP;
      }
      const [newAst] = await db.insert(customerAssets).values({
        assetNumber: `AST-${Date.now() % 10000}`,
        customerId: testCust.id,
        productId: prod.id,
        customName: 'Office RO Purifier',
        serialNumber: 'SR-RO-998811',
        assetType: 'RO_MACHINE',
        purchaseDate: new Date(),
        status: 'ACTIVE',
      }).returning();
      testAsset = newAst;
    }

    const tomorrow = new Date(Date.now() + 20 * 60 * 60 * 1000);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const srv = await servicesRepository.createService({
      customerId: testCust.id,
      assetId: testAsset.id,
      serviceType: 'PERIODIC_MAINTENANCE',
      serviceLocation: 'DOORSTEP',
      serviceClassification: 'WARRANTY',
      scheduledDate: tomorrowStr,
      scheduledTimeSlot: '10:00 AM - 12:00 PM',
      priority: 'NORMAL',
      customerNotes: '6-Month Periodic Filter & Membrane Replacement',
    });

    // Send reminder
    const sendResult = await emailService.sendServiceReminder(srv.service.id);
    expect(sendResult).toBeDefined();
    expect(sendResult?.recipientEmail).toBe(testCust.email.toLowerCase());
    expect(sendResult?.idempotencyKey).toContain(srv.service.id);

    // Duplicate check
    const duplicateResult = await emailService.sendServiceReminder(srv.service.id);
    expect(duplicateResult?.jobId).toBe(sendResult?.jobId); // Idempotency returns same job

    // Scheduler scan test
    const schedulerReport = await emailScheduler.scanAndTrigger();
    expect(schedulerReport).toBeDefined();
    expect(schedulerReport.status).toBe('COMPLETED');
  }, 15000);

  it('TEST 10: should update service completely including schedule, notes, technician, and job card fields', async () => {
    let [testCust] = await db.select().from(customers).limit(1);
    if (!testCust) {
      const [newCust] = await db.insert(customers).values({
        customerNumber: `CUST-EDIT-${Date.now() % 10000}`,
        fullName: 'Rohan Sharma Test',
        phone: '9876540000',
        email: `rohan.${Date.now()}@example.com`,
        status: 'ACTIVE',
      }).returning();
      testCust = newCust;
    }

    const created = await servicesRepository.createService({
      customerId: testCust.id,
      serviceType: 'PERIODIC_MAINTENANCE',
      serviceLocation: 'DOORSTEP',
      serviceClassification: 'GENERAL',
      scheduledDate: '2026-09-25',
      scheduledTimeSlot: '10:00 AM - 12:00 PM',
      priority: 'NORMAL',
      customerNotes: 'Initial service request',
    });

    expect(created.service.id).toBeDefined();

    // Perform complete update of all attributes
    const updated = await servicesRepository.updateService(created.service.id, {
      serviceType: 'REPAIR',
      serviceLocation: 'IN_SHOP',
      serviceClassification: 'WARRANTY',
      scheduledDate: '2026-10-05',
      scheduledTimeSlot: '02:00 PM - 04:00 PM',
      priority: 'URGENT',
      customerNotes: 'Updated customer complaint - filter leakage',
      internalNotes: 'Use heavy-duty clamp kit',
      diagnosis: 'O-ring worn out',
      workPerformed: 'Replaced O-ring and test ran 30 mins',
      technicianNotes: 'Advised client on input water pressure',
      customerRemarks: 'Very satisfied with fix',
      laborCharges: 350,
      partsCharges: 150,
      totalCharges: 500,
    });

    expect(updated).toBeDefined();
    expect(updated.serviceType).toBe('REPAIR');
    expect(updated.serviceLocation).toBe('IN_SHOP');
    expect(updated.serviceClassification).toBe('WARRANTY');
    expect(updated.priority).toBe('URGENT');
    expect(updated.customerNotes).toBe('Updated customer complaint - filter leakage');
    expect(updated.internalNotes).toBe('Use heavy-duty clamp kit');

    // Verify detail lookup joined with updated job card
    const detail = await servicesRepository.findById(created.service.id);
    expect(detail).toBeDefined();
    expect(detail?.serviceType).toBe('REPAIR');
    expect(detail?.diagnosis).toBe('O-ring worn out');
    expect(detail?.workPerformed).toBe('Replaced O-ring and test ran 30 mins');
    expect(Number(detail?.laborCharges)).toBe(350);
    expect(Number(detail?.partsCharges)).toBe(150);
    expect(Number(detail?.totalCharges)).toBe(500);
  });

  it('TEST 11: should schedule a service with custom machine name and display only that machine in service list', async () => {
    // 1. Create a customer specifically for custom machine scheduling
    const [cust] = await db
      .insert(customers)
      .values({
        customerNumber: `CUST-MCH-${Date.now() % 10000}`,
        fullName: 'Custom Machine Customer',
        phone: '9988776655',
        status: 'ACTIVE',
      })
      .returning();

    // 2. Schedule service specifying an exact custom machine name
    const customMachine = 'Kent Grand Plus RO Alkaline';
    const created = await servicesRepository.createService({
      customerId: cust.id,
      machineName: customMachine,
      serviceType: 'PERIODIC_MAINTENANCE',
      serviceLocation: 'DOORSTEP',
      serviceClassification: 'GENERAL',
      scheduledDate: '2026-10-15',
      scheduledTimeSlot: '10:00 AM - 12:00 PM',
      priority: 'NORMAL',
    });

    expect(created.service).toBeDefined();

    // 3. Query services list and verify exact machine name is projected in productName
    const servicesList = await servicesRepository.findPaginated({
      customerId: cust.id,
      page: 1,
      limit: 10,
    });

    expect(servicesList.data.length).toBeGreaterThan(0);
    const targetService = servicesList.data.find((s) => s.id === created.service.id);
    expect(targetService).toBeDefined();
    expect(targetService?.productName).toBe(customMachine);
    expect(targetService?.productName).not.toBe('Customer RO Water Purifier');
  });
});
