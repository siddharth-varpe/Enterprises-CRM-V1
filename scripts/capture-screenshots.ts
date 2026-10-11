/**
 * Enterprises CRM v1.2.0 - Automated Screenshot Capture Suite
 * Captures real, genuine application screenshots from live running instances.
 * 
 * Usage:
 *   pnpm --filter @crm/web exec tsx ../../scripts/capture-screenshots.ts
 * 
 * Requirements:
 *   - Fastify API running on http://127.0.0.1:4000
 *   - Web client running on http://127.0.0.1:3000
 *   - Demo dataset seeded via `pnpm --filter @crm/api exec tsx src/database/seeds/demo-dataset.ts`
 */
import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const ROOT_DIR = path.resolve(__dirname, '..');
const SCREENSHOTS_DIR = path.join(ROOT_DIR, 'docs/screenshots');

async function main() {
  fs.mkdirSync(path.join(SCREENSHOTS_DIR, 'admin'), { recursive: true });
  fs.mkdirSync(path.join(SCREENSHOTS_DIR, 'auth'), { recursive: true });
  fs.mkdirSync(path.join(SCREENSHOTS_DIR, 'technician'), { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    console.log('====================================================');
    console.log('ENTERPRISES CRM - AUTOMATED SCREENSHOT CAPTURE SUITE');
    console.log('====================================================');

    // -------------------------------------------------------------------------
    // 1. AUTHENTICATION & ADMIN PORTAL (DESKTOP: 1440x900)
    // -------------------------------------------------------------------------
    console.log('\n[1/3] Capturing Admin Portal & Authentication Screens...');
    const adminCtx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const adminPage = await adminCtx.newPage();

    async function snapAdmin(relPath: string) {
      await adminPage.screenshot({
        path: path.join(SCREENSHOTS_DIR, relPath),
        animations: 'disabled',
        timeout: 15000,
      });
      console.log(`  ✓ ${relPath}`);
    }

    // A. Splash screen
    await adminPage.goto('http://127.0.0.1:3000/login', { waitUntil: 'commit' });
    await adminPage.waitForTimeout(300);
    await snapAdmin('auth/01-splash-screen.png');

    // B. Admin Login Form (wait for splash fade-out)
    await adminPage.waitForTimeout(3000);
    await snapAdmin('auth/02-admin-login.png');

    // C. Perform Admin Login
    const instantAdminBtn = adminPage.getByRole('button', { name: /One-Click Instant Access/i });
    if (await instantAdminBtn.isVisible()) {
      await instantAdminBtn.click();
    } else {
      await adminPage.locator('input[type="text"]').first().fill('admin');
      await adminPage.locator('input[type="password"]').fill('admin');
      await adminPage.locator('button[type="submit"]').first().click();
    }
    await adminPage.waitForURL('**/dashboard', { timeout: 15000 });
    await adminPage.waitForTimeout(2500);

    // D. Admin Modules
    const adminRoutes: [string, string, number?][] = [
      ['/dashboard', 'admin/01-dashboard.png', 2500],
      ['/customers', 'admin/02-customer-directory.png', 2000],
      ['/customers/00000000-0000-0000-0000-000000000001', 'admin/03-customer-profile.png', 2500],
      ['/sales', 'admin/04-sales-directory.png', 2000],
      ['/sales/new', 'admin/05-sale-create.png', 2000],
      ['/invoices', 'admin/06-invoice-directory.png', 2000],
      ['/invoices/00000000-0000-0000-0000-000000001101', 'admin/07-invoice-detail.png', 2500],
      ['/payments', 'admin/08-payments-directory.png', 2000],
      ['/assets', 'admin/09-assets-directory.png', 2000],
      ['/services', 'admin/10-services-directory.png', 2000],
      ['/services/00000000-0000-0000-0000-000000001201', 'admin/11-service-detail.png', 2500],
      ['/job-cards', 'admin/12-job-cards-directory.png', 2000],
      ['/job-cards/00000000-0000-0000-0000-000000001301', 'admin/13-job-card-detail.png', 2500],
      ['/rent', 'admin/14-rentals-management.png', 2000],
      ['/technicians', 'admin/15-technicians-roster.png', 2000],
      ['/technicians/00000000-0000-0000-0000-000000000099', 'admin/16-technician-profile.png', 2500],
      ['/technicians/map', 'admin/17-live-map.png', 4000],
      ['/dues', 'admin/18-dues-ledger.png', 2000],
      ['/inventory', 'admin/19-inventory-management.png', 2000],
      ['/reminders', 'admin/20-reminders-tasks.png', 2000],
      ['/whatsapp', 'admin/21-whatsapp-hub.png', 2000],
      ['/reports', 'admin/22-reports-analytics.png', 2500],
      ['/notifications', 'admin/23-notifications-center.png', 2000],
      ['/settings', 'admin/24-system-settings.png', 2000],
      ['/invoice/view/00000000-0000-0000-0000-000000001101', 'admin/25-public-invoice-view.png', 2500],
    ];

    for (const [route, file, wait] of adminRoutes) {
      await adminPage.goto(`http://127.0.0.1:3000${route}`, { waitUntil: 'commit' });
      await adminPage.waitForTimeout(wait || 2000);
      await snapAdmin(file);
    }
    await adminCtx.close();

    // -------------------------------------------------------------------------
    // 2. TECHNICIAN PORTAL (DESKTOP: 1440x900)
    // -------------------------------------------------------------------------
    console.log('\n[2/3] Capturing Technician Portal Desktop Screens...');
    const techCtx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const techPage = await techCtx.newPage();

    async function snapTech(relPath: string) {
      await techPage.screenshot({
        path: path.join(SCREENSHOTS_DIR, relPath),
        animations: 'disabled',
        timeout: 15000,
      });
      console.log(`  ✓ ${relPath}`);
    }

    await techPage.goto('http://127.0.0.1:3000/technician/login', { waitUntil: 'commit' });
    await techPage.waitForTimeout(4000);
    await snapTech('auth/03-technician-login.png');

    await techPage.locator('#tech-phone').fill('9999999999');
    await techPage.locator('#tech-name').fill('Ramesh Bomble (Super Admin)');
    await techPage.locator('button:has-text("Send Verification Code")').click();
    await techPage.waitForTimeout(2000);
    await snapTech('auth/04-technician-otp.png');

    const otpInput = techPage.locator('#tech-otp');
    if (await otpInput.isVisible()) {
      await otpInput.fill('000000');
      await techPage.locator('button[type="submit"]').first().click();
    } else {
      await techPage.getByRole('button', { name: /Super Admin Bypass/i }).click();
    }
    await techPage.waitForURL('**/technician', { timeout: 15000 });
    await techPage.waitForTimeout(3000);

    const techRoutes: [string, string, number?][] = [
      ['/technician', 'technician/01-technician-dashboard.png', 2500],
      ['/technician/services', 'technician/02-assigned-services.png', 2000],
      ['/technician/services/00000000-0000-0000-0000-000000001201', 'technician/03-service-detail.png', 2500],
      ['/technician/navigation', 'technician/04-service-navigation.png', 3500],
      ['/technician/completed-services', 'technician/05-job-completion.png', 2000],
      ['/technician/profile', 'technician/06-profile.png', 2000],
      ['/technician/notifications', 'technician/07-technician-notifications.png', 2000],
    ];

    for (const [route, file, wait] of techRoutes) {
      await techPage.goto(`http://127.0.0.1:3000${route}`, { waitUntil: 'commit' });
      await techPage.waitForTimeout(wait || 2000);
      await snapTech(file);
    }
    await techCtx.close();

    // -------------------------------------------------------------------------
    // 3. TECHNICIAN PORTAL (MOBILE VIEWPORT: 390x844)
    // -------------------------------------------------------------------------
    console.log('\n[3/3] Capturing Technician Portal Mobile Viewport Screens...');
    const mobileCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const mobilePage = await mobileCtx.newPage();

    async function snapMobile(relPath: string) {
      await mobilePage.screenshot({
        path: path.join(SCREENSHOTS_DIR, relPath),
        animations: 'disabled',
        timeout: 15000,
      });
      console.log(`  ✓ ${relPath}`);
    }

    await mobilePage.goto('http://127.0.0.1:3000/technician/login', { waitUntil: 'commit' });
    await mobilePage.waitForTimeout(4000);
    const bypassBtn = mobilePage.getByRole('button', { name: /Super Admin Bypass/i });
    if (await bypassBtn.isVisible()) {
      await bypassBtn.click();
    } else {
      await mobilePage.locator('#tech-phone').fill('9999999999');
      await mobilePage.locator('#tech-name').fill('Ramesh Bomble (Super Admin)');
      await mobilePage.locator('button:has-text("Send Verification Code")').click();
      await mobilePage.waitForTimeout(2000);
      await mobilePage.locator('#tech-otp').fill('000000');
      await mobilePage.locator('button[type="submit"]').first().click();
    }
    await mobilePage.waitForURL('**/technician', { timeout: 15000 });
    await mobilePage.waitForTimeout(3000);

    await snapMobile('technician/mobile-01-dashboard.png');

    await mobilePage.goto('http://127.0.0.1:3000/technician/services/00000000-0000-0000-0000-000000001201', { waitUntil: 'commit' });
    await mobilePage.waitForTimeout(2500);
    await snapMobile('technician/mobile-02-service-detail.png');

    await mobilePage.goto('http://127.0.0.1:3000/technician/navigation', { waitUntil: 'commit' });
    await mobilePage.waitForTimeout(3500);
    await snapMobile('technician/mobile-03-navigation.png');

    await mobileCtx.close();

    console.log('\n====================================================');
    console.log('ALL SCREENSHOTS CAPTURED & SAVED TO docs/screenshots/');
    console.log('====================================================');
  } catch (err: any) {
    console.error('Fatal error during capture:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
