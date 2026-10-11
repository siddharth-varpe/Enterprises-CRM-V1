import { db } from '../client';
import {
  users,
  roles,
  customers,
  customerAddresses,
  products,
  customerAssets,
  sales,
  saleItems,
  invoices,
  invoiceItems,
  payments,
  warranties,
  services,
  jobCards,
  technicians,
  technicianPortalAccess,
  rentals,
  inquiries,
  notifications,
  reminders,
} from '../schema/index';
import { env } from '../../config/env';

/**
 * Safe, Idempotent Demo Dataset for Enterprises CRM v1.2.0
 * Provides rich, realistic operational records for:
 * - Executive Dashboards & Key Metrics
 * - Customer Directory & Asset Ownership
 * - Sales Orders, Invoices & GST Accounting
 * - Payments, Dues & Financial Ledgers
 * - Field Service Dispatch & Job Cards
 * - Scheduled Maintenance Heatmap & Due Ledgers
 * - Equipment Rentals & Subscriptions
 * - Inbound Website Inquiries & Leads
 * - Notifications & Follow-up Reminders
 * - Technician Workforce & GPS Navigation
 */
export async function seedDemoDataset(): Promise<void> {
  if (env.NODE_ENV === 'production' && !process.env.ALLOW_PROD_SEED) {
    console.error('⛔ Refusing to seed demo dataset in production environment without explicit ALLOW_PROD_SEED=true');
    return;
  }

  console.log('🌱 Starting safe, idempotent Enterprises CRM demo dataset seeding...');

  const today = new Date();
  const past30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const past28Days = new Date(today.getTime() - 28 * 24 * 60 * 60 * 1000);
  const past15Days = new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000);
  const past10Days = new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000);
  const past5Days = new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000);
  const past2Days = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const in3Days = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
  const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const in90Days = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
  const in365Days = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000);

  // -------------------------------------------------------------
  // 1. SEED TECHNICIANS
  // -------------------------------------------------------------
  const demoTechnicians = [
    {
      id: '00000000-0000-0000-0000-000000000099', // Super Admin Tech
      fullName: 'Ramesh Bomble (Super Admin)',
      phone: '9999999999',
      email: 'admin@srenterprises.com',
      status: 'ACTIVE' as const,
      skills: ['RO Installation', 'Water Purifier Service', 'Industrial Overhaul', 'Electronics Repair'],
      address: 'Central Service Depot, Shivaji Nagar, Pune',
      emergencyContact: '9999900000',
    },
    {
      id: '00000000-0000-0000-0000-000000000101',
      fullName: 'Pawan Kumar (Demo Tech)',
      phone: '9876500001',
      email: 'pawan@example.com',
      status: 'ACTIVE' as const,
      skills: ['Domestic RO Installation', 'Filter Replacement', 'TDS Calibration'],
      address: 'Kothrud Service Hub, Pune',
      emergencyContact: '9876500099',
    },
    {
      id: '00000000-0000-0000-0000-000000000102',
      fullName: 'Amit Sharma (Demo Tech)',
      phone: '9876500002',
      email: 'amit@example.com',
      status: 'ACTIVE' as const,
      skills: ['Commercial RO Plants', 'Pump Overhauls', 'Membrane Replacement'],
      address: 'Hinjawadi IT Park Zone, Pune',
      emergencyContact: '9876500098',
    },
    {
      id: '00000000-0000-0000-0000-000000000103',
      fullName: 'Rajesh Verma (Demo Tech)',
      phone: '9876500003',
      email: 'rajesh@example.com',
      status: 'ACTIVE' as const,
      skills: ['Doorstep Maintenance', 'Sanitization', 'Electrical Diagnostics'],
      address: 'Viman Nagar Area Office, Pune',
      emergencyContact: '9876500097',
    },
  ];

  for (const tech of demoTechnicians) {
    await db.insert(technicians).values(tech).onConflictDoUpdate({
      target: technicians.id,
      set: {
        fullName: tech.fullName,
        phone: tech.phone,
        email: tech.email,
        status: tech.status,
        skills: tech.skills,
        address: tech.address,
      },
    });

    // Ensure portal access enabled
    await db.insert(technicianPortalAccess).values({
      technicianId: tech.id,
      portalEnabled: true,
    }).onConflictDoUpdate({
      target: technicianPortalAccess.technicianId,
      set: { portalEnabled: true },
    });
  }
  console.log('  ✓ Seeded 4 Technicians with Portal Access');

  // -------------------------------------------------------------
  // 2. SEED PRODUCTS & PARTS CATALOG
  // -------------------------------------------------------------
  const demoProducts = [
    {
      id: '00000000-0000-0000-0000-000000000201',
      sku: 'PROD-RO-KENT-GP',
      name: 'Kent Grand Plus RO (15L/hr)',
      productType: 'RO_MACHINE' as const,
      brand: 'Kent',
      model: 'Grand Plus 2026',
      description: 'Mineral RO Technology with in-tank UV disinfection and digital TDS display.',
      unitPrice: '18500.00',
      taxRatePercent: '18.00',
      defaultWarrantyMonths: 12,
      defaultServiceIntervalMonths: 4,
      isActive: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000202',
      sku: 'PROD-RO-AQUA-GEN',
      name: 'Aquaguard Geneus RO+UV (12L/hr)',
      productType: 'RO_MACHINE' as const,
      brand: 'Eureka Forbes',
      model: 'Geneus Active Copper',
      description: 'Active Copper with Zinc Booster, Taste Adjuster (MTDS) and dual cartridge.',
      unitPrice: '16200.00',
      taxRatePercent: '18.00',
      defaultWarrantyMonths: 12,
      defaultServiceIntervalMonths: 6,
      isActive: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000203',
      sku: 'PROD-RO-COMM-50L',
      name: 'Commercial RO Purification Plant (50 LPH)',
      productType: 'RO_MACHINE' as const,
      brand: 'SR Industrial',
      model: 'SR-COM-50',
      description: 'Heavy-duty 50 Liters/Hour commercial plant for offices, clinics and hostels.',
      unitPrice: '45000.00',
      taxRatePercent: '18.00',
      defaultWarrantyMonths: 24,
      defaultServiceIntervalMonths: 3,
      isActive: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000204',
      sku: 'PART-SED-10INCH',
      name: 'Spun Polypropylene Sediment Filter 10"',
      productType: 'SPARE_PART' as const,
      brand: 'AquaPure',
      model: 'SED-10-5M',
      description: '5 Micron premium spun filter cartridge for removing suspended sand, rust and dirt.',
      unitPrice: '350.00',
      taxRatePercent: '18.00',
      defaultWarrantyMonths: 3,
      defaultServiceIntervalMonths: 3,
      isActive: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000205',
      sku: 'PART-CARB-BLOCK',
      name: 'Activated Carbon Block Filter 10"',
      productType: 'SPARE_PART' as const,
      brand: 'AquaPure',
      model: 'CTO-10',
      description: 'Coconut shell carbon block for chlorine adsorption, organic removal and odor control.',
      unitPrice: '550.00',
      taxRatePercent: '18.00',
      defaultWarrantyMonths: 6,
      defaultServiceIntervalMonths: 6,
      isActive: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000206',
      sku: 'PART-RO-MEM-75G',
      name: 'Thin-Film Composite RO Membrane 75 GPD',
      productType: 'SPARE_PART' as const,
      brand: 'Dow Filmtec',
      model: 'BW60-1812-75',
      description: 'High-rejection 98% salt reduction membrane for TDS reduction up to 2500 ppm.',
      unitPrice: '1800.00',
      taxRatePercent: '18.00',
      defaultWarrantyMonths: 12,
      defaultServiceIntervalMonths: 12,
      isActive: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000207',
      sku: 'PART-BOOST-PUMP',
      name: 'Diaphragm Booster Pump 100 GPD (24V)',
      productType: 'SPARE_PART' as const,
      brand: 'Kemflo',
      model: 'KF-100G',
      description: 'Low-noise, 120 PSI operational booster pump with heavy-duty copper windings.',
      unitPrice: '2200.00',
      taxRatePercent: '18.00',
      defaultWarrantyMonths: 12,
      defaultServiceIntervalMonths: 12,
      isActive: true,
    },
    {
      id: '00000000-0000-0000-0000-000000000208',
      sku: 'PART-SMPS-24V',
      name: 'Waterproof SMPS Power Supply 24V 2.5A',
      productType: 'SPARE_PART' as const,
      brand: 'AquaPower',
      model: 'SMPS-24V-2.5A',
      description: 'Surge-protected industrial grade power supply adapter.',
      unitPrice: '750.00',
      taxRatePercent: '18.00',
      defaultWarrantyMonths: 12,
      defaultServiceIntervalMonths: 12,
      isActive: true,
    },
  ];

  for (const prod of demoProducts) {
    await db.insert(products).values(prod).onConflictDoUpdate({
      target: products.id,
      set: {
        name: prod.name,
        sku: prod.sku,
        unitPrice: prod.unitPrice,
        taxRatePercent: prod.taxRatePercent,
        description: prod.description,
        brand: prod.brand,
        model: prod.model,
      },
    });
  }
  console.log('  ✓ Seeded 8 Products & Spare Parts');

  // -------------------------------------------------------------
  // 3. SEED CUSTOMERS & PINPOINT ADDRESSES (Pune & Suburban Geo-Coordinates)
  // -------------------------------------------------------------
  const demoCustomers = [
    {
      id: '00000000-0000-0000-0000-000000000301',
      customerNumber: 'CUST-DEMO-001',
      fullName: 'Ananya Sharma (Demo Residential)',
      phone: '9820000001',
      email: 'ananya.sharma@example.com',
      customerType: 'INDIVIDUAL' as const,
      status: 'ACTIVE' as const,
      customerLabel: 'GOOD' as const,
      notes: 'Prefers morning service appointments between 10 AM - 12 PM.',
      address: {
        id: '00000000-0000-0000-0000-000000000401',
        addressLine1: 'Flat 402, Magnolia Heights, Model Colony',
        addressLine2: 'Near Deep Bungalow Chowk',
        landmark: 'Opposite State Bank',
        city: 'Pune',
        state: 'Maharashtra',
        postalCode: '411016',
        latitude: 18.5314,
        longitude: 73.8446,
      },
    },
    {
      id: '00000000-0000-0000-0000-000000000302',
      customerNumber: 'CUST-DEMO-002',
      fullName: 'Metro Diagnostic Center (Demo Commercial)',
      phone: '9820000002',
      email: 'admin@metrodiagnostics-demo.example.com',
      customerType: 'COMMERCIAL' as const,
      companyName: 'Metro Diagnostic Center Pvt Ltd',
      gstNumber: '27AABCM5678F1Z8',
      status: 'ACTIVE' as const,
      customerLabel: 'GOOD' as const,
      notes: 'Requires strict TDS < 20 ppm for laboratory hematology analyzers.',
      address: {
        id: '00000000-0000-0000-0000-000000000402',
        addressLine1: 'Ground Floor, Commercial Complex, F.C. Road',
        addressLine2: 'Deccan Gymkhana',
        landmark: 'Next to Goodluck Cafe',
        city: 'Pune',
        state: 'Maharashtra',
        postalCode: '411004',
        latitude: 18.5167,
        longitude: 73.8415,
      },
    },
    {
      id: '00000000-0000-0000-0000-000000000303',
      customerNumber: 'CUST-DEMO-003',
      fullName: 'Vikram Deshmukh (Demo Residential)',
      phone: '9820000003',
      email: 'vikram.d@example.com',
      customerType: 'INDIVIDUAL' as const,
      status: 'ACTIVE' as const,
      customerLabel: 'GOOD' as const,
      notes: 'Kent Grand Plus installed in kitchen. Regular AMC customer.',
      address: {
        id: '00000000-0000-0000-0000-000000000403',
        addressLine1: 'B-12, Kumar Peninsula, Baner Road',
        addressLine2: 'Near Orchid School',
        landmark: 'Balewadi Phata',
        city: 'Pune',
        state: 'Maharashtra',
        postalCode: '411045',
        latitude: 18.5590,
        longitude: 73.7868,
      },
    },
    {
      id: '00000000-0000-0000-0000-000000000304',
      customerNumber: 'CUST-DEMO-004',
      fullName: 'Dr. Kalam English Academy (Demo School Rental)',
      phone: '9820000004',
      email: 'facilities@kalamacademy-demo.example.com',
      customerType: 'COMMERCIAL' as const,
      companyName: 'Dr. APJ Abdul Kalam Educational Trust',
      gstNumber: '27AABCK1234E1Z4',
      status: 'ACTIVE' as const,
      customerLabel: 'GOOD' as const,
      notes: 'Active monthly rental subscription: 50 LPH RO Plant with water cooler.',
      address: {
        id: '00000000-0000-0000-0000-000000000404',
        addressLine1: 'Campus Building A, Magarpatta City Main Road',
        addressLine2: 'Hadapsar',
        landmark: 'Behind Destination Center',
        city: 'Pune',
        state: 'Maharashtra',
        postalCode: '411028',
        latitude: 18.5089,
        longitude: 73.9260,
      },
    },
    {
      id: '00000000-0000-0000-0000-000000000305',
      customerNumber: 'CUST-DEMO-005',
      fullName: 'Pooja Joshi (Demo Residential)',
      phone: '9820000005',
      email: 'pooja.joshi@example.com',
      customerType: 'INDIVIDUAL' as const,
      status: 'ACTIVE' as const,
      customerLabel: 'GOOD' as const,
      notes: 'Inquiry converted to sale. Active warranty protection.',
      address: {
        id: '00000000-0000-0000-0000-000000000405',
        addressLine1: 'Row House 5, Mayur Colony, Kothrud',
        addressLine2: 'Near Joggers Park',
        landmark: 'Karve Statue Chowk',
        city: 'Pune',
        state: 'Maharashtra',
        postalCode: '411038',
        latitude: 18.5074,
        longitude: 73.8077,
      },
    },
    {
      id: '00000000-0000-0000-0000-000000000306',
      customerNumber: 'CUST-DEMO-006',
      fullName: 'Apex Tech Solutions (Demo IT Corporate)',
      phone: '9820000006',
      email: 'admin@apextech-demo.example.com',
      customerType: 'COMMERCIAL' as const,
      companyName: 'Apex Tech Solutions India LLP',
      gstNumber: '27AABCA9988D1Z2',
      status: 'ACTIVE' as const,
      customerLabel: 'GOOD' as const,
      notes: 'Pantry RO service required quarterly on Saturdays.',
      address: {
        id: '00000000-0000-0000-0000-000000000406',
        addressLine1: 'Tower 3, Level 4, Rajiv Gandhi Infotech Park',
        addressLine2: 'Phase 1, Hinjawadi',
        landmark: 'Opposite Wipro Circle',
        city: 'Pune',
        state: 'Maharashtra',
        postalCode: '411057',
        latitude: 18.5913,
        longitude: 73.7389,
      },
    },
  ];

  for (const cust of demoCustomers) {
    const { address, ...custFields } = cust;
    await db.insert(customers).values(custFields).onConflictDoUpdate({
      target: customers.id,
      set: {
        fullName: custFields.fullName,
        phone: custFields.phone,
        email: custFields.email,
        companyName: custFields.companyName,
        gstNumber: custFields.gstNumber,
        notes: custFields.notes,
        status: custFields.status,
      },
    });

    await db.insert(customerAddresses).values({
      id: address.id,
      customerId: cust.id,
      addressType: 'BOTH' as const,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      landmark: address.landmark,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      latitude: address.latitude,
      longitude: address.longitude,
      isDefault: true,
    }).onConflictDoUpdate({
      target: customerAddresses.id,
      set: {
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        landmark: address.landmark,
        latitude: address.latitude,
        longitude: address.longitude,
      },
    });
  }
  console.log('  ✓ Seeded 6 Customers with Pinpoint GPS Coordinates');

  // -------------------------------------------------------------
  // 4. SEED CUSTOMER ASSETS
  // -------------------------------------------------------------
  const demoAssets = [
    {
      id: '00000000-0000-0000-0000-000000000501',
      assetNumber: 'AST-2026-0001',
      customerId: '00000000-0000-0000-0000-000000000301', // Ananya
      productId: '00000000-0000-0000-0000-000000000201', // Kent GP
      assetType: 'RO_MACHINE' as const,
      serialNumber: 'SN-KENT-2026-8812',
      customName: 'Kitchen RO Purifier',
      purchaseDate: past30Days,
      initialWarrantyMonths: 12,
      serviceIntervalMonths: 4,
      status: 'ACTIVE' as const,
    },
    {
      id: '00000000-0000-0000-0000-000000000502',
      assetNumber: 'AST-2026-0002',
      customerId: '00000000-0000-0000-0000-000000000302', // Metro Diagnostics
      productId: '00000000-0000-0000-0000-000000000203', // 50 LPH Plant
      assetType: 'RO_MACHINE' as const,
      serialNumber: 'SN-COM-2025-4421',
      customName: 'Pathology Lab RO Plant',
      purchaseDate: new Date('2025-11-10'),
      initialWarrantyMonths: 24,
      serviceIntervalMonths: 3,
      status: 'ACTIVE' as const,
    },
    {
      id: '00000000-0000-0000-0000-000000000503',
      assetNumber: 'AST-2026-0003',
      customerId: '00000000-0000-0000-0000-000000000303', // Vikram Deshmukh
      productId: '00000000-0000-0000-0000-000000000202', // Aquaguard
      assetType: 'RO_MACHINE' as const,
      serialNumber: 'SN-AG-2026-1190',
      customName: 'Main Residence RO',
      purchaseDate: past15Days,
      initialWarrantyMonths: 12,
      serviceIntervalMonths: 6,
      status: 'ACTIVE' as const,
    },
    {
      id: '00000000-0000-0000-0000-000000000504',
      assetNumber: 'AST-2026-0004',
      customerId: '00000000-0000-0000-0000-000000000305', // Pooja Joshi
      productId: '00000000-0000-0000-0000-000000000201', // Kent GP
      assetType: 'RO_MACHINE' as const,
      serialNumber: 'SN-KENT-2026-9044',
      customName: 'Domestic RO Machine',
      purchaseDate: past5Days,
      initialWarrantyMonths: 12,
      serviceIntervalMonths: 4,
      status: 'ACTIVE' as const,
    },
  ];

  for (const asset of demoAssets) {
    await db.insert(customerAssets).values(asset).onConflictDoUpdate({
      target: customerAssets.id,
      set: {
        serialNumber: asset.serialNumber,
        customName: asset.customName,
        status: asset.status,
      },
    });
  }
  console.log('  ✓ Seeded 4 Customer Assets');

  // -------------------------------------------------------------
  // 5. SEED SALES ORDERS & ITEMS
  // -------------------------------------------------------------
  const demoSales = [
    {
      id: '00000000-0000-0000-0000-000000000601',
      saleNumber: 'SALE-2026-0001',
      customerId: '00000000-0000-0000-0000-000000000301', // Ananya
      saleDate: past30Days,
      status: 'COMPLETED' as const,
      subtotal: '18500.00',
      discountAmount: '500.00',
      taxAmount: '3240.00',
      totalAmount: '21240.00',
      notes: 'New Kent Grand Plus installation package with complimentary 1-year service.',
      items: [
        {
          id: '00000000-0000-0000-0000-000000000701',
          productId: '00000000-0000-0000-0000-000000000201',
          productNameSnapshot: 'Kent Grand Plus RO (15L/hr)',
          skuSnapshot: 'PROD-RO-KENT-GP',
          quantity: 1,
          unitPriceSnapshot: '18500.00',
          discountAmount: '500.00',
          taxRatePercent: '18.00',
          taxAmount: '3240.00',
          lineTotal: '21240.00',
          warrantyMonths: 12,
          serialNumber: 'SN-KENT-2026-8812',
        },
      ],
    },
    {
      id: '00000000-0000-0000-0000-000000000602',
      saleNumber: 'SALE-2026-0002',
      customerId: '00000000-0000-0000-0000-000000000303', // Vikram
      saleDate: past15Days,
      status: 'COMPLETED' as const,
      subtotal: '16200.00',
      discountAmount: '200.00',
      taxAmount: '2880.00',
      totalAmount: '18880.00',
      notes: 'Aquaguard Geneus sale with pre-filter assembly.',
      items: [
        {
          id: '00000000-0000-0000-0000-000000000702',
          productId: '00000000-0000-0000-0000-000000000202',
          productNameSnapshot: 'Aquaguard Geneus RO+UV (12L/hr)',
          skuSnapshot: 'PROD-RO-AQUA-GEN',
          quantity: 1,
          unitPriceSnapshot: '16200.00',
          discountAmount: '200.00',
          taxRatePercent: '18.00',
          taxAmount: '2880.00',
          lineTotal: '18880.00',
          warrantyMonths: 12,
          serialNumber: 'SN-AG-2026-1190',
        },
      ],
    },
  ];

  for (const s of demoSales) {
    const { items, ...saleFields } = s;
    await db.insert(sales).values(saleFields).onConflictDoUpdate({
      target: sales.id,
      set: {
        totalAmount: saleFields.totalAmount,
        status: saleFields.status,
      },
    });

    for (const item of items) {
      await db.insert(saleItems).values({
        ...item,
        saleId: s.id,
      }).onConflictDoNothing();
    }
  }
  console.log('  ✓ Seeded 2 Sales Orders with Line Items');

  // -------------------------------------------------------------
  // 6. SEED INVOICES & GST BILLING
  // -------------------------------------------------------------
  const demoInvoices = [
    {
      id: '00000000-0000-0000-0000-000000000801',
      invoiceNumber: 'INV-2026-0001',
      customerId: '00000000-0000-0000-0000-000000000301', // Ananya
      saleId: '00000000-0000-0000-0000-000000000601',
      invoiceDate: past30Days,
      dueDate: past15Days,
      subtotal: '18000.00',
      discountAmount: '0.00',
      taxAmount: '3240.00',
      totalAmount: '21240.00',
      status: 'PAID' as const,
      termsAndConditions: '1 Year Comprehensive Warranty included. Payment receipt acknowledged.',
      items: [
        {
          id: '00000000-0000-0000-0000-000000000901',
          productId: '00000000-0000-0000-0000-000000000201',
          itemType: 'PRODUCT' as const,
          nameSnapshot: 'Kent Grand Plus RO (15L/hr)',
          quantity: 1,
          unitPriceSnapshot: '18000.00',
          discountAmount: '0.00',
          taxRatePercent: '18.00',
          taxAmount: '3240.00',
          lineTotal: '21240.00',
        },
      ],
    },
    {
      id: '00000000-0000-0000-0000-000000000802',
      invoiceNumber: 'INV-2026-0002',
      customerId: '00000000-0000-0000-0000-000000000302', // Metro Diagnostics
      invoiceDate: past15Days,
      dueDate: past2Days,
      subtotal: '4500.00',
      discountAmount: '0.00',
      taxAmount: '810.00',
      totalAmount: '5310.00',
      status: 'PARTIALLY_PAID' as const,
      poNumber: 'PO-MDC-9921',
      termsAndConditions: 'Quarterly Maintenance Overhaul & 5-micron pre-treatment filter replacement.',
      items: [
        {
          id: '00000000-0000-0000-0000-000000000902',
          itemType: 'SERVICE' as const,
          nameSnapshot: 'Commercial 50 LPH Overhaul Service & Membrane Flushing',
          quantity: 1,
          unitPriceSnapshot: '3000.00',
          taxRatePercent: '18.00',
          taxAmount: '540.00',
          lineTotal: '3540.00',
        },
        {
          id: '00000000-0000-0000-0000-000000000903',
          productId: '00000000-0000-0000-0000-000000000205',
          itemType: 'SPARE_PART' as const,
          nameSnapshot: 'Activated Carbon Block Filter 10"',
          quantity: 2,
          unitPriceSnapshot: '750.00',
          taxRatePercent: '18.00',
          taxAmount: '270.00',
          lineTotal: '1770.00',
        },
      ],
    },
    {
      id: '00000000-0000-0000-0000-000000000803',
      invoiceNumber: 'INV-2026-0003',
      customerId: '00000000-0000-0000-0000-000000000303', // Vikram
      saleId: '00000000-0000-0000-0000-000000000602',
      invoiceDate: past15Days,
      dueDate: in7Days,
      subtotal: '16000.00',
      discountAmount: '0.00',
      taxAmount: '2880.00',
      totalAmount: '18880.00',
      status: 'ISSUED' as const,
      termsAndConditions: 'Payment due within 15 days of machine delivery and installation.',
      items: [
        {
          id: '00000000-0000-0000-0000-000000000904',
          productId: '00000000-0000-0000-0000-000000000202',
          itemType: 'PRODUCT' as const,
          nameSnapshot: 'Aquaguard Geneus RO+UV (12L/hr)',
          quantity: 1,
          unitPriceSnapshot: '16000.00',
          taxRatePercent: '18.00',
          taxAmount: '2880.00',
          lineTotal: '18880.00',
        },
      ],
    },
    {
      id: '00000000-0000-0000-0000-000000000804',
      invoiceNumber: 'INV-2026-0004',
      customerId: '00000000-0000-0000-0000-000000000304', // Kalam Academy
      invoiceDate: past5Days,
      dueDate: past2Days,
      subtotal: '4500.00',
      discountAmount: '0.00',
      taxAmount: '810.00',
      totalAmount: '5310.00',
      status: 'OVERDUE' as const,
      termsAndConditions: 'Monthly rental fee for 50 LPH Plant. Net 7 days.',
      items: [
        {
          id: '00000000-0000-0000-0000-000000000905',
          itemType: 'SERVICE' as const,
          nameSnapshot: 'Monthly Equipment Rental Subscription (October 2026)',
          quantity: 1,
          unitPriceSnapshot: '4500.00',
          taxRatePercent: '18.00',
          taxAmount: '810.00',
          lineTotal: '5310.00',
        },
      ],
    },
  ];

  for (const inv of demoInvoices) {
    const { items, ...invFields } = inv;
    await db.insert(invoices).values(invFields).onConflictDoUpdate({
      target: invoices.id,
      set: {
        totalAmount: invFields.totalAmount,
        status: invFields.status,
      },
    });

    for (const item of items) {
      await db.insert(invoiceItems).values({
        ...item,
        invoiceId: inv.id,
      }).onConflictDoNothing();
    }
  }
  console.log('  ✓ Seeded 4 GST Invoices (Paid, Partially Paid, Issued, Overdue)');

  // -------------------------------------------------------------
  // 7. SEED PAYMENTS & FINANCIAL LEDGER
  // -------------------------------------------------------------
  const demoPayments = [
    {
      id: '00000000-0000-0000-0000-000000001001',
      paymentNumber: 'PAY-2026-0001',
      customerId: '00000000-0000-0000-0000-000000000301', // Ananya
      invoiceId: '00000000-0000-0000-0000-000000000801', // INV-1 (Paid in full)
      amount: '21240.00',
      paymentDate: past28Days,
      paymentMethod: 'UPI' as const,
      status: 'COMPLETED' as const,
      referenceNumber: 'UPI/261028001923/HDFC',
      notes: 'Instant Google Pay payment at installation.',
    },
    {
      id: '00000000-0000-0000-0000-000000001002',
      paymentNumber: 'PAY-2026-0002',
      customerId: '00000000-0000-0000-0000-000000000302', // Metro Diagnostics
      invoiceId: '00000000-0000-0000-0000-000000000802', // INV-2 (Partial payment)
      amount: '3000.00',
      paymentDate: past10Days,
      paymentMethod: 'BANK_TRANSFER' as const,
      status: 'COMPLETED' as const,
      referenceNumber: 'NEFT/N26101009871/ICICI',
      notes: 'Advance part payment credited to company account.',
    },
  ];

  for (const pay of demoPayments) {
    await db.insert(payments).values(pay).onConflictDoUpdate({
      target: payments.id,
      set: {
        amount: pay.amount,
        status: pay.status,
      },
    });
  }
  console.log('  ✓ Seeded 2 Payments (Full UPI & Partial Bank Transfer)');

  // -------------------------------------------------------------
  // 8. SEED WARRANTIES
  // -------------------------------------------------------------
  const demoWarranties = [
    {
      id: '00000000-0000-0000-0000-000000001101',
      warrantyNumber: 'WAR-2026-0001',
      customerId: '00000000-0000-0000-0000-000000000301',
      assetId: '00000000-0000-0000-0000-000000000501',
      warrantyType: 'STANDARD_MACHINE' as const,
      startDate: past30Days,
      endDate: in365Days,
      durationMonths: 12,
      status: 'ACTIVE' as const,
      terms: 'Comprehensive 1-year coverage on RO Booster pump, SMPS, and Solenoid Valve.',
    },
    {
      id: '00000000-0000-0000-0000-000000001102',
      warrantyNumber: 'WAR-2026-0002',
      customerId: '00000000-0000-0000-0000-000000000303',
      assetId: '00000000-0000-0000-0000-000000000503',
      warrantyType: 'STANDARD_MACHINE' as const,
      startDate: past15Days,
      endDate: in365Days,
      durationMonths: 12,
      status: 'ACTIVE' as const,
      terms: 'Manufacturer factory warranty for 12 months with 2 free scheduled servicings.',
    },
  ];

  for (const war of demoWarranties) {
    await db.insert(warranties).values(war).onConflictDoUpdate({
      target: warranties.id,
      set: {
        status: war.status,
      },
    });
  }
  console.log('  ✓ Seeded 2 Warranties');

  // -------------------------------------------------------------
  // 9. SEED SERVICES & FIELD JOB CARDS (Today, Assigned, Scheduled, Overdue)
  // -------------------------------------------------------------
  const demoServices = [
    {
      id: '00000000-0000-0000-0000-000000001201',
      serviceNumber: 'SRV-2026-0010',
      customerId: '00000000-0000-0000-0000-000000000301', // Ananya Sharma
      assetId: '00000000-0000-0000-0000-000000000501',
      technicianId: '00000000-0000-0000-0000-000000000099', // Ramesh Bomble (Super Admin Tech)
      serviceType: 'PERIODIC_MAINTENANCE' as const,
      serviceLocation: 'DOORSTEP' as const,
      serviceClassification: 'WARRANTY' as const,
      scheduledDate: today, // TODAY!
      scheduledTimeSlot: '11:00 AM - 01:00 PM',
      status: 'ASSIGNED' as const,
      priority: 'HIGH' as const,
      customerNotes: 'Water flow rate has slightly reduced over the last week. Please check pre-filter.',
      internalNotes: 'First quarterly maintenance under active warranty WAR-2026-0001.',
      jobCard: {
        id: '00000000-0000-0000-0000-000000001301',
        jobCardNumber: 'JC-2026-0010',
        problemReported: 'Slow purified water flow and filter maintenance check',
        diagnosis: 'Sediment pre-filter saturated with municipal line silt; booster pump pressure verified normal (95 PSI).',
        status: 'ASSIGNED' as const,
        laborCharges: '0.00',
        partsCharges: '0.00',
        totalCharges: '0.00',
      },
    },
    {
      id: '00000000-0000-0000-0000-000000001202',
      serviceNumber: 'SRV-2026-0011',
      customerId: '00000000-0000-0000-0000-000000000302', // Metro Diagnostics
      assetId: '00000000-0000-0000-0000-000000000502',
      technicianId: '00000000-0000-0000-0000-000000000102', // Amit Sharma
      serviceType: 'REPAIR' as const,
      serviceLocation: 'DOORSTEP' as const,
      serviceClassification: 'GENERAL' as const,
      scheduledDate: today, // TODAY!
      scheduledTimeSlot: '02:30 PM - 04:30 PM',
      status: 'IN_PROGRESS' as const,
      priority: 'URGENT' as const,
      customerNotes: 'Lab analyzer feed pipe pressure sensor trip.',
      internalNotes: 'Technician on site inspecting membrane housing.',
      jobCard: {
        id: '00000000-0000-0000-0000-000000001302',
        jobCardNumber: 'JC-2026-0011',
        problemReported: 'High TDS alarm on lab analyzer inline feed',
        diagnosis: 'Primary post-carbon block exhausted; flushing secondary RO stage.',
        workPerformed: 'Replaced carbon block; backwashed commercial membrane housing; calibrated digital TDS sensor to 18 ppm.',
        status: 'IN_PROGRESS' as const,
        laborCharges: '800.00',
        partsCharges: '1100.00',
        totalCharges: '1900.00',
      },
    },
    {
      id: '00000000-0000-0000-0000-000000001203',
      serviceNumber: 'SRV-2026-0012',
      customerId: '00000000-0000-0000-0000-000000000303', // Vikram Deshmukh
      assetId: '00000000-0000-0000-0000-000000000503',
      technicianId: '00000000-0000-0000-0000-000000000101', // Pawan Kumar
      serviceType: 'INSTALLATION' as const,
      serviceLocation: 'DOORSTEP' as const,
      serviceClassification: 'WARRANTY' as const,
      scheduledDate: past2Days,
      scheduledTimeSlot: '10:00 AM - 12:00 PM',
      status: 'COMPLETED' as const,
      priority: 'NORMAL' as const,
      customerNotes: 'New machine doorstep installation and plumbing connection.',
      internalNotes: 'Installation signed off by customer. Raw TDS: 420 ppm -> Purified TDS: 48 ppm.',
      completedAt: past2Days,
      jobCard: {
        id: '00000000-0000-0000-0000-000000001303',
        jobCardNumber: 'JC-2026-0012',
        problemReported: 'New installation commissioning',
        diagnosis: 'Installation completed with wall mounting bracket and brass diverter valve.',
        workPerformed: 'Mounted purifier on kitchen wall; connected 1/4" food grade tubing; purged initial 10 liters.',
        customerRemarks: 'Excellent technician service, very clean installation.',
        status: 'COMPLETED' as const,
        startedAt: past2Days,
        completedAt: past2Days,
        laborCharges: '0.00',
        partsCharges: '0.00',
        totalCharges: '0.00',
      },
    },
    {
      id: '00000000-0000-0000-0000-000000001204',
      serviceNumber: 'SRV-2026-0013',
      customerId: '00000000-0000-0000-0000-000000000305', // Pooja Joshi
      assetId: '00000000-0000-0000-0000-000000000504',
      technicianId: '00000000-0000-0000-0000-000000000103', // Rajesh Verma
      serviceType: 'PERIODIC_MAINTENANCE' as const,
      serviceLocation: 'DOORSTEP' as const,
      serviceClassification: 'GENERAL' as const,
      scheduledDate: tomorrow,
      scheduledTimeSlot: '04:00 PM - 06:00 PM',
      status: 'SCHEDULED' as const,
      priority: 'NORMAL' as const,
      customerNotes: '6-Month routine checkup and filter replacement reminder.',
      internalNotes: 'Dispatched notification via WhatsApp.',
      jobCard: {
        id: '00000000-0000-0000-0000-000000001304',
        jobCardNumber: 'JC-2026-0013',
        problemReported: 'Scheduled periodic maintenance inspection',
        status: 'SCHEDULED' as const,
        laborCharges: '350.00',
        partsCharges: '550.00',
        totalCharges: '900.00',
      },
    },
  ];

  for (const s of demoServices) {
    const { jobCard, ...serviceFields } = s;
    await db.insert(services).values(serviceFields).onConflictDoUpdate({
      target: services.id,
      set: {
        status: serviceFields.status,
        scheduledDate: serviceFields.scheduledDate,
        scheduledTimeSlot: serviceFields.scheduledTimeSlot,
      },
    });

    await db.insert(jobCards).values({
      ...jobCard,
      serviceId: s.id,
      customerId: s.customerId,
      assetId: s.assetId,
      technicianId: s.technicianId,
    }).onConflictDoUpdate({
      target: jobCards.id,
      set: {
        status: jobCard.status,
        diagnosis: jobCard.diagnosis,
        workPerformed: jobCard.workPerformed,
        totalCharges: jobCard.totalCharges,
      },
    });
  }
  console.log('  ✓ Seeded 4 Services & Job Cards (Assigned, In Progress, Completed, Scheduled)');

  // -------------------------------------------------------------
  // 10. SEED RENTALS (Subscriptions & Agreements)
  // -------------------------------------------------------------
  const demoRentals = [
    {
      id: '00000000-0000-0000-0000-000000001401',
      rentalNumber: 'RNT-2026-0001',
      customerId: '00000000-0000-0000-0000-000000000304', // Kalam Academy
      machineType: 'Commercial RO 50 LPH',
      machineModel: 'SR-COM-50 Industrial Cooler Hybrid',
      serialNumber: 'RNT-SN-50L-101',
      capacityLph: '50 LPH',
      installationLocation: 'Staff Canteen Water Station',
      machineCondition: 'GOOD' as const,
      rentalStartDate: new Date('2026-08-01'),
      rentalDuration: '12_MONTHS' as const,
      minimumRentalPeriodMonths: 6,
      billingFrequency: 'MONTHLY' as const,
      monthlyRent: '4500.00',
      billingAmount: '4500.00',
      securityDeposit: '10000.00',
      depositStatus: 'COLLECTED' as const,
      totalPaid: '9000.00',
      outstandingAmount: '4500.00',
      nextDueDate: in30Days,
      rentalStatus: 'ACTIVE' as const,
      paymentStatus: 'DUE' as const,
      technicianId: '00000000-0000-0000-0000-000000000102',
      technicianName: 'Amit Sharma',
      installationStatus: 'INSTALLED' as const,
    },
    {
      id: '00000000-0000-0000-0000-000000001402',
      rentalNumber: 'RNT-2026-0002',
      customerId: '00000000-0000-0000-0000-000000000306', // Apex Tech Solutions
      machineType: 'RO + UV Purifier',
      machineModel: 'Kent Grand Plus Rental Fleet',
      serialNumber: 'RNT-SN-KENT-209',
      capacityLph: '15 LPH',
      installationLocation: '4th Floor Pantry Area',
      machineCondition: 'NEW' as const,
      rentalStartDate: new Date('2026-09-15'),
      rentalDuration: '6_MONTHS' as const,
      minimumRentalPeriodMonths: 3,
      billingFrequency: 'MONTHLY' as const,
      monthlyRent: '1200.00',
      billingAmount: '1200.00',
      securityDeposit: '3000.00',
      depositStatus: 'COLLECTED' as const,
      totalPaid: '2400.00',
      outstandingAmount: '0.00',
      nextDueDate: in30Days,
      rentalStatus: 'ACTIVE' as const,
      paymentStatus: 'PAID' as const,
      technicianId: '00000000-0000-0000-0000-000000000101',
      technicianName: 'Pawan Kumar',
      installationStatus: 'INSTALLED' as const,
    },
  ];

  for (const r of demoRentals) {
    await db.insert(rentals).values(r).onConflictDoUpdate({
      target: rentals.id,
      set: {
        rentalStatus: r.rentalStatus,
        paymentStatus: r.paymentStatus,
        monthlyRent: r.monthlyRent,
      },
    });
  }
  console.log('  ✓ Seeded 2 Machine Rental Agreements');

  // -------------------------------------------------------------
  // 11. SEED INBOUND INQUIRIES & LEADS
  // -------------------------------------------------------------
  const demoInquiries = [
    {
      id: '00000000-0000-0000-0000-000000001501',
      inquiryNumber: 'INQ-2026-0001',
      name: 'Dr. Sameer Kulkarni',
      phone: '9823456781',
      email: 'dr.sameer@dentalcare-demo.example.com',
      city: 'Pune (Shivaji Nagar)',
      productInterest: 'Kent Grand Plus RO',
      serviceInterest: 'New Clinic Installation',
      inquiryType: 'NEW_PURCHASE' as const,
      message: 'Need water purifier installation for our newly opened dental clinic. Require high quality bacterial filtration.',
      source: 'WEBSITE' as const,
      status: 'NEW' as const,
      priority: 'HIGH' as const,
      followUpDate: tomorrow,
    },
    {
      id: '00000000-0000-0000-0000-000000001502',
      name: 'Sunita Patil',
      inquiryNumber: 'INQ-2026-0002',
      phone: '9823456782',
      email: 'sunita.patil@example.com',
      city: 'Pune (Hadapsar)',
      productInterest: 'Commercial RO Plant',
      serviceInterest: 'Monthly Rental Option',
      inquiryType: 'PRODUCT_INFORMATION' as const,
      message: 'Looking for 25 LPH or 50 LPH RO machine on monthly rental for our coaching center with 80 students.',
      source: 'REFERRAL' as const,
      status: 'CONTACTED' as const,
      priority: 'NORMAL' as const,
      followUpDate: in3Days,
    },
    {
      id: '00000000-0000-0000-0000-000000001503',
      name: 'Rohan Mehra',
      inquiryNumber: 'INQ-2026-0003',
      phone: '9823456783',
      email: 'rohan.m@example.com',
      city: 'Pune (Kothrud)',
      productInterest: 'RO Membrane & Spun Filter',
      serviceInterest: 'Emergency Membrane Replacement',
      inquiryType: 'REPAIR' as const,
      message: 'Current purifier is making loud buzzing noise and wastewater discharge is constant without tank filling.',
      source: 'DIRECT_CALL' as const,
      status: 'IN_PROGRESS' as const,
      priority: 'URGENT' as const,
      followUpDate: today,
    },
  ];

  for (const inq of demoInquiries) {
    await db.insert(inquiries).values(inq).onConflictDoUpdate({
      target: inquiries.id,
      set: {
        status: inq.status,
        priority: inq.priority,
      },
    });
  }
  console.log('  ✓ Seeded 3 Leads & Inquiries (New, Contacted, In Progress)');

  // -------------------------------------------------------------
  // 12. SEED NOTIFICATIONS & ACTIONABLE ALERTS
  // -------------------------------------------------------------
  const demoNotifications = [
    {
      id: '00000000-0000-0000-0000-000000001601',
      notificationType: 'SERVICE_DUE' as const,
      title: 'Service Due Today: Ananya Sharma',
      message: 'Periodic maintenance call SRV-2026-0010 scheduled for 11:00 AM at Model Colony, Pune.',
      priority: 'HIGH' as const,
      entityType: 'SERVICE',
      entityId: '00000000-0000-0000-0000-000000001201',
      actionUrl: '/services/00000000-0000-0000-0000-000000001201',
      isRead: false,
    },
    {
      id: '00000000-0000-0000-0000-000000001602',
      notificationType: 'SYSTEM_ALERT' as const,
      title: 'UPI Payment Received: ₹21,240',
      message: 'Invoice INV-2026-0001 settled in full via Google Pay UPI reference UPI/261028001923.',
      priority: 'NORMAL' as const,
      entityType: 'PAYMENT',
      entityId: '00000000-0000-0000-0000-000000001001',
      actionUrl: '/payments',
      isRead: true,
    },
    {
      id: '00000000-0000-0000-0000-000000001603',
      notificationType: 'NEW_INQUIRY' as const,
      title: 'New High-Priority Lead Received',
      message: 'Dr. Sameer Kulkarni submitted installation inquiry for Dental Clinic in Shivaji Nagar.',
      priority: 'HIGH' as const,
      entityType: 'INQUIRY',
      entityId: '00000000-0000-0000-0000-000000001501',
      actionUrl: '/inquiries',
      isRead: false,
    },
    {
      id: '00000000-0000-0000-0000-000000001604',
      notificationType: 'PAYMENT_DUE' as const,
      title: 'Rental Invoice Overdue: Kalam Academy',
      message: 'Monthly rental invoice INV-2026-0004 for ₹5,310 is 2 days past due date.',
      priority: 'URGENT' as const,
      entityType: 'INVOICE',
      entityId: '00000000-0000-0000-0000-000000000804',
      actionUrl: '/invoices/00000000-0000-0000-0000-000000000804',
      isRead: false,
    },
  ];

  for (const n of demoNotifications) {
    await db.insert(notifications).values(n).onConflictDoNothing();
  }
  console.log('  ✓ Seeded 4 Operational Notifications');

  // -------------------------------------------------------------
  // 13. SEED REMINDERS & FOLLOW-UPS
  // -------------------------------------------------------------
  const demoReminders = [
    {
      id: '00000000-0000-0000-0000-000000001701',
      reminderNumber: 'REM-2026-0001',
      customerId: '00000000-0000-0000-0000-000000000302', // Metro Diagnostics
      invoiceId: '00000000-0000-0000-0000-000000000802',
      reminderType: 'PAYMENT_FOLLOW_UP' as const,
      reminderDate: today,
      reminderTime: '03:00 PM',
      priority: 'HIGH' as const,
      status: 'PENDING' as const,
      notes: 'Follow up with accounts department for remaining ₹2,310 balance on INV-2026-0002.',
    },
    {
      id: '00000000-0000-0000-0000-000000001702',
      reminderNumber: 'REM-2026-0002',
      customerId: '00000000-0000-0000-0000-000000000304', // Kalam Academy
      invoiceId: '00000000-0000-0000-0000-000000000804',
      reminderType: 'OVERDUE_PAYMENT' as const,
      reminderDate: tomorrow,
      reminderTime: '11:30 AM',
      priority: 'URGENT' as const,
      status: 'PENDING' as const,
      notes: 'Contact administration officer regarding overdue rental check clearance.',
    },
  ];

  for (const rem of demoReminders) {
    await db.insert(reminders).values(rem).onConflictDoNothing();
  }
  console.log('  ✓ Seeded 2 Operational Reminders');

  console.log('✅ Enterprises CRM demo dataset seeded successfully!\n');
}

// Allow direct CLI invocation: tsx src/database/seeds/demo-dataset.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDemoDataset()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal error seeding demo dataset:', err);
      process.exit(1);
    });
}
