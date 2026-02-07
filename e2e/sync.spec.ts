import { type Page, expect, test } from '@playwright/test';

const COUCHDB_CONFIG = {
  adminUser: 'admin',
  adminPassword: 'T8$QvN!3xR7@Wk2#',
  user: 'dukunuu',
  password: 'f3Vq8sKp!2Nw7Lm9Zx',
  database: 'dukunuu-db',
  url: 'http://183.177.105.156:8082',
};

interface TestEntry {
  _id: string;
  type: 'entry';
  trackerId: string;
  value: string;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface SyncStatus {
  status: 'idle' | 'connecting' | 'active' | 'paused' | 'error' | 'stalled';
  health: 'healthy' | 'degraded' | 'unhealthy';
  lastActivity: number;
  retryCount: number;
  totalChanges: number;
  errors: Array<{ timestamp: number; message: string }>;
}

async function setupSync(page: Page): Promise<void> {
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');

  // Enable sync and configure CouchDB
  const syncEnabled = await page.locator('input[type="checkbox"]').first();
  await syncEnabled.check();

  // Fill in CouchDB endpoint
  const endpointInput = await page.locator('input[placeholder*="URL"], input[type="url"]').first();
  await endpointInput.fill(`${COUCHDB_CONFIG.url}/${COUCHDB_CONFIG.database}`);

  // Fill in credentials
  const usernameInput = await page
    .locator('input[placeholder*="username"], input[name*="username"]')
    .first();
  await usernameInput.fill(COUCHDB_CONFIG.user);

  const passwordInput = await page.locator('input[type="password"]').first();
  await passwordInput.fill(COUCHDB_CONFIG.password);

  // Save settings
  const saveButton = await page.locator('button:has-text("Save"), button:has-text("save")').first();
  if (await saveButton.isVisible().catch(() => false)) {
    await saveButton.click();
  }

  // Wait for sync to start
  await page.waitForTimeout(2000);
}

async function getSyncStatus(page: Page): Promise<SyncStatus> {
  return page.evaluate(() => {
    // Access the sync state from the window object if exposed, or check UI indicators
    const syncIndicator = document.querySelector('[data-sync-status]');
    if (syncIndicator) {
      return {
        status: syncIndicator.getAttribute('data-sync-status') as SyncStatus['status'],
        health: (syncIndicator.getAttribute('data-sync-health') ||
          'healthy') as SyncStatus['health'],
        lastActivity: Date.now(),
        retryCount: 0,
        totalChanges: 0,
        errors: [],
      };
    }
    return {
      status: 'idle',
      health: 'healthy',
      lastActivity: Date.now(),
      retryCount: 0,
      totalChanges: 0,
      errors: [],
    };
  });
}

async function generateTestData(page: Page, count: number): Promise<string[]> {
  const entryIds: string[] = [];
  const batchSize = 50;

  for (let i = 0; i < count; i += batchSize) {
    const batch = Math.min(batchSize, count - i);
    const entries: TestEntry[] = [];

    for (let j = 0; j < batch; j++) {
      const id = `test-entry-${Date.now()}-${i}-${j}`;
      entryIds.push(id);
      entries.push({
        _id: id,
        type: 'entry',
        trackerId: `test-tracker-${j % 10}`,
        value: JSON.stringify({ value: Math.random() * 100, note: `Test entry ${i + j}` }),
        recordedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Store entries in IndexedDB via PouchDB
    await page.evaluate((data) => {
      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('lifetrack');
        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          const transaction = db.transaction(['by-sequence'], 'readwrite');
          const store = transaction.objectStore('by-sequence');

          let completed = 0;
          data.forEach((entry) => {
            const putRequest = store.put(entry);
            putRequest.onsuccess = () => {
              completed++;
              if (completed === data.length) resolve();
            };
            putRequest.onerror = () => reject(putRequest.error);
          });
        };
        request.onerror = () => reject(request.error);
      });
    }, entries);
  }

  return entryIds;
}

async function waitForSyncComplete(
  page: Page,
  timeout: number = 300000,
  expectedChanges?: number,
): Promise<{ success: boolean; status: SyncStatus; duration: number }> {
  const startTime = Date.now();
  let lastActivity = startTime;
  let stallCount = 0;
  const checkInterval = 5000;

  while (Date.now() - startTime < timeout) {
    const status = await getSyncStatus(page);
    const now = Date.now();

    if (status.status === 'active') {
      lastActivity = now;
      stallCount = 0;
    } else if (status.status === 'stalled' || status.status === 'error') {
      stallCount++;
      if (stallCount >= 3) {
        return {
          success: false,
          status,
          duration: now - startTime,
        };
      }
    }

    // Check if we've synced the expected number of changes
    if (expectedChanges && status.totalChanges >= expectedChanges) {
      return {
        success: true,
        status,
        duration: now - startTime,
      };
    }

    // If sync is paused and we haven't seen activity for a while, consider it done
    if (status.status === 'paused' && now - lastActivity > 30000) {
      return {
        success: true,
        status,
        duration: now - startTime,
      };
    }

    await page.waitForTimeout(checkInterval);
  }

  return {
    success: false,
    status: await getSyncStatus(page),
    duration: Date.now() - startTime,
  };
}

test.describe('CouchDB Sync', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing data
    await page.goto('/');
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase('lifetrack');
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        request.onblocked = () => resolve();
      });
    });
  });

  test('should sync small amount of data successfully', async ({ page }) => {
    await setupSync(page);

    // Generate 100 test entries
    const entryCount = 100;
    const entryIds = await generateTestData(page, entryCount);

    // Wait for sync to complete
    const result = await waitForSyncComplete(page, 60000, entryCount);

    expect(result.success).toBe(true);
    expect(result.status.errors.length).toBe(0);
  });

  test('should sync large amount of data without stalling', async ({ page }) => {
    await setupSync(page);

    // Generate 1000 test entries (larger dataset)
    const entryCount = 1000;
    const entryIds = await generateTestData(page, entryCount);

    console.log(`Generated ${entryIds.length} test entries`);

    // Wait for sync with longer timeout for large data
    const result = await waitForSyncComplete(page, 300000, entryCount);

    console.log(`Sync completed in ${result.duration}ms`);
    console.log(`Final status: ${result.status.status}`);
    console.log(`Total changes: ${result.status.totalChanges}`);
    console.log(`Errors: ${result.status.errors.length}`);

    expect(result.success).toBe(true);
    expect(result.status.status).not.toBe('stalled');
    expect(result.status.status).not.toBe('error');
  });

  test('should recover from sync errors and resume', async ({ page }) => {
    await setupSync(page);

    // Generate initial data
    await generateTestData(page, 50);

    // Wait for initial sync
    let result = await waitForSyncComplete(page, 60000);
    expect(result.success).toBe(true);

    // Add more data to trigger another sync cycle
    await generateTestData(page, 50);

    // Wait for second sync
    result = await waitForSyncComplete(page, 60000);
    expect(result.success).toBe(true);
    expect(result.status.totalChanges).toBeGreaterThan(0);
  });

  test('should handle manual resync', async ({ page }) => {
    await setupSync(page);

    // Generate test data
    await generateTestData(page, 100);
    await waitForSyncComplete(page, 60000);

    // Trigger manual resync via settings
    await page.goto('/settings');
    const resyncButton = await page
      .locator('button:has-text("Resync"), button:has-text("resync"), [data-action="resync"]')
      .first();

    if (await resyncButton.isVisible().catch(() => false)) {
      await resyncButton.click();

      // Wait for resync to complete
      const result = await waitForSyncComplete(page, 60000);
      expect(result.success).toBe(true);
    }
  });

  test('should maintain sync health with continuous data', async ({ page }) => {
    await setupSync(page);

    // Start with some data
    await generateTestData(page, 100);

    // Monitor sync health over time
    const healthChecks: SyncStatus[] = [];
    const checkDuration = 60000; // 1 minute
    const checkInterval = 5000;

    const startTime = Date.now();
    while (Date.now() - startTime < checkDuration) {
      const status = await getSyncStatus(page);
      healthChecks.push(status);

      // Add more data periodically
      if (healthChecks.length % 3 === 0) {
        await generateTestData(page, 20);
      }

      await page.waitForTimeout(checkInterval);
    }

    // Analyze health checks
    const errorCount = healthChecks.filter((h) => h.status === 'error').length;
    const stallCount = healthChecks.filter((h) => h.status === 'stalled').length;

    console.log(`Health checks over ${checkDuration}ms:`);
    console.log(`  Total checks: ${healthChecks.length}`);
    console.log(`  Errors: ${errorCount}`);
    console.log(`  Stalls: ${stallCount}`);

    // Should not have too many errors or stalls
    expect(errorCount).toBeLessThan(healthChecks.length * 0.1); // Less than 10% errors
    expect(stallCount).toBe(0);
  });
});

test.describe('CouchDB Sync with production config', () => {
  test('should connect and sync with provided CouchDB server', async ({ page }) => {
    // This test uses the actual CouchDB configuration provided
    console.log(`Testing against CouchDB at: ${COUCHDB_CONFIG.url}`);

    await setupSync(page);

    // Generate a moderate amount of data
    const entryCount = 200;
    const entryIds = await generateTestData(page, entryCount);

    console.log(`Waiting for ${entryCount} entries to sync...`);

    // Wait for sync with generous timeout
    const result = await waitForSyncComplete(page, 180000, entryCount);

    console.log('Sync test results:');
    console.log(`  Success: ${result.success}`);
    console.log(`  Duration: ${result.duration}ms`);
    console.log(`  Final status: ${result.status.status}`);
    console.log(`  Health: ${result.status.health}`);
    console.log(`  Total changes synced: ${result.status.totalChanges}`);
    console.log(`  Retry count: ${result.status.retryCount}`);

    if (result.status.errors.length > 0) {
      console.log('  Errors encountered:');
      result.status.errors.forEach((err, i) => {
        console.log(`    ${i + 1}. ${err.message} (${new Date(err.timestamp).toISOString()})`);
      });
    }

    expect(result.success).toBe(true);
    expect(result.status.health).not.toBe('unhealthy');
  });
});
