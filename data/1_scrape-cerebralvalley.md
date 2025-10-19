
we scraped all participants with playwright:

```js

// login.js
// Authentication script for Cerebral Valley
// Uses Patchright (undetected Playwright) for Google OAuth login

import { chromium } from 'patchright';
import fs from 'fs';
import path from 'path';
import os from 'os';

const AUTH_FILE_PATH = path.join(path.dirname(new URL(import.meta.url).pathname), 'auth.json');
const LOGIN_URL = 'https://cerebralvalley.ai/auth/login';
const SUCCESS_URL = 'https://cerebralvalley.ai/';
const LOGIN_TIMEOUT = 300000; // 5 minutes

// User data directory for persistent Chrome profile
const USER_DATA_DIR = path.join(os.tmpdir(), 'patchright-cerebralvalley-profile');

async function runLogin() {
  console.log('=== Cerebral Valley Authentication ===\n');

  // Check if already authenticated
  if (fs.existsSync(AUTH_FILE_PATH)) {
    console.log('✓ Authentication file (auth.json) already exists.');
    console.log('  Your session is saved and ready to use.');
    console.log('\nTo re-authenticate:');
    console.log('  1. Delete auth.json');
    console.log('  2. Run this script again\n');
    return;
  }

  console.log('Starting authentication process...\n');

  let context;
  try {
    // Use Patchright's best practice: launchPersistentContext with Chrome
    // This avoids fingerprint detection and passes all bot checks
    console.log('Launching Chrome browser with Patchright (undetected mode)...');
    console.log('Note: Using Patchright to bypass Google\'s bot detection.\n');

    // Create user data directory if it doesn't exist
    if (!fs.existsSync(USER_DATA_DIR)) {
      fs.mkdirSync(USER_DATA_DIR, { recursive: true });
    }

    context = await chromium.launchPersistentContext(USER_DATA_DIR, {
      channel: 'chrome',  // Use real Chrome, not Chromium
      headless: false,    // Must be visible for manual login
      viewport: null,     // Use Chrome's default viewport (more natural)
      // DO NOT add custom userAgent or headers - let Chrome use defaults
      locale: 'en-US',
      timezoneId: 'America/Los_Angeles'
    });

    const page = context.pages()[0] || await context.newPage();

    console.log(`Navigating to login page: ${LOGIN_URL}`);
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });

    console.log('\n=== ACTION REQUIRED ===');
    console.log('Please complete the following steps in the browser window:');
    console.log('  1. Click "Login with Google"');
    console.log('  2. Select your Google account');
    console.log('  3. Authorize the application');
    console.log('  4. Wait for redirect to homepage\n');
    console.log('This script will automatically continue once you are logged in...\n');

    // Wait for successful redirect to homepage
    try {
      await page.waitForURL(SUCCESS_URL, { timeout: LOGIN_TIMEOUT });
      console.log('✓ Login successful!');
    } catch (error) {
      if (error.message.includes('timeout')) {
        console.error('\n✗ Login timeout: No redirect detected within 5 minutes.');
        console.error('  Please try again and complete the login process faster.');
      } else {
        console.error('\n✗ Login failed:', error.message);
      }
      await browser.close();
      process.exit(1);
    }

    // Give the page a moment to fully load
    await page.waitForTimeout(2000);

    // Save authentication state
    console.log('Saving authentication state...');
    await context.storageState({ path: AUTH_FILE_PATH });
    console.log(`✓ Authentication state saved to ${path.basename(AUTH_FILE_PATH)}`);

    console.log('\n=== Authentication Complete ===');
    console.log('You can now run the scraper with: node scrape.js\n');

    await context.close();

  } catch (error) {
    console.error('\n✗ Unexpected error during authentication:', error.message);
    console.error('\nStack trace:', error.stack);
    if (context) {
      await context.close();
    }
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n\nAuthentication cancelled by user.');
  process.exit(0);
});

runLogin();

```

```js
// scrape.js
// Enhanced scraper for Cerebral Valley hackathon guest list
// Uses Patchright (undetected Playwright) for stealth scraping
// Features: Resume capability, retry logic, progress tracking, full profile data extraction

import { chromium } from 'patchright';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Configuration
const AUTH_FILE_PATH = path.join(path.dirname(new URL(import.meta.url).pathname), 'auth.json');
const PROGRESS_FILE_PATH = path.join(path.dirname(new URL(import.meta.url).pathname), 'progress.json');
const OUTPUT_FILE = path.join(path.dirname(new URL(import.meta.url).pathname), 'guest_profiles.json');
const TARGET_URL = 'https://cerebralvalley.ai/e/2025-ted-ai-hackathon?tab=guest-list';
const EXPECTED_GUEST_COUNT = 426;

// User data directory (same as login script for session reuse)
const USER_DATA_DIR = path.join(os.tmpdir(), 'patchright-cerebralvalley-profile');

// Selectors
const SCROLLABLE_SELECTOR = '[role="tabpanel"][data-state="active"] div[style*="overflow: auto"]';
const GUEST_ITEM_SELECTOR = 'a.contents';

// Timing and retry settings - optimized for balance between speed and completeness
const SCROLL_INCREMENT_PX = 500;  // Medium scroll chunks (sweet spot for virtualized lists)
const SCROLL_WAIT_MS = 150;  // Balanced wait time
const DOM_SETTLE_MS = 400;  // Enough time for mutations to settle
const CHECKPOINT_INTERVAL = 50; // Save progress every N profiles
const MAX_RETRIES = 3;
const RETRY_DELAYS = [500, 1000, 2000];
const MAX_CONSECUTIVE_NO_CHANGE = 7;  // More patience to ensure we get everything

// Progress tracking
let startTime;
let lastUpdateTime;
let lastCount = 0;

/**
 * Sleep helper function
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for DOM changes to settle using MutationObserver
 * Returns true if mutations were detected, false if timeout
 */
async function waitForDOMChanges(element, timeoutMs = DOM_SETTLE_MS) {
  return await element.evaluate((node, timeout) => {
    return new Promise((resolve) => {
      let mutationDetected = false;
      let timeoutId;

      const observer = new MutationObserver((mutations) => {
        if (mutations.length > 0) {
          mutationDetected = true;
          // Reset timeout on each mutation
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            observer.disconnect();
            resolve(true);
          }, timeout);
        }
      });

      observer.observe(node, {
        childList: true,
        subtree: true
      });

      // Initial timeout
      timeoutId = setTimeout(() => {
        observer.disconnect();
        resolve(mutationDetected);
      }, timeout);
    });
  }, timeoutMs);
}

/**
 * Scroll incrementally by fixed pixel amounts instead of jumping to bottom
 * This gives virtualized lists time to render new content
 */
async function scrollIncrementally(scrollableElement, incrementPx = SCROLL_INCREMENT_PX) {
  const scrollInfo = await scrollableElement.evaluate((node, increment) => {
    const oldScrollTop = node.scrollTop;
    const scrollHeight = node.scrollHeight;
    const clientHeight = node.clientHeight;

    // Scroll by increment or to bottom, whichever is less
    const newScrollTop = Math.min(oldScrollTop + increment, scrollHeight - clientHeight);
    node.scrollTop = newScrollTop;

    return {
      oldScrollTop,
      newScrollTop,
      scrollHeight,
      clientHeight,
      atBottom: newScrollTop + clientHeight >= scrollHeight - 10  // 10px tolerance
    };
  }, incrementPx);

  return scrollInfo;
}

/**
 * Retry wrapper with exponential backoff
 */
async function withRetry(fn, context = 'Operation') {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === MAX_RETRIES - 1) {
        throw error;
      }
      const delay = RETRY_DELAYS[attempt];
      console.log(`  ⚠ ${context} failed (attempt ${attempt + 1}/${MAX_RETRIES}): ${error.message}`);
      console.log(`    Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
}

/**
 * Load progress from checkpoint file
 */
function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(PROGRESS_FILE_PATH, 'utf8'));
      console.log(`✓ Loaded checkpoint: ${data.profiles.length} profiles from previous run`);
      return data;
    } catch (error) {
      console.log(`⚠ Could not load checkpoint: ${error.message}`);
      return { profiles: [], profileUrls: new Set() };
    }
  }
  return { profiles: [], profileUrls: new Set() };
}

/**
 * Save progress checkpoint
 */
function saveProgress(profiles) {
  const data = {
    profiles: profiles,
    timestamp: new Date().toISOString(),
    count: profiles.length
  };
  fs.writeFileSync(PROGRESS_FILE_PATH, JSON.stringify(data, null, 2));
}

/**
 * Calculate and display progress statistics
 */
function displayProgress(currentCount, newThisCycle) {
  const percentage = ((currentCount / EXPECTED_GUEST_COUNT) * 100).toFixed(1);

  // Calculate rate and ETA
  const timeSinceLastUpdate = Date.now() - lastUpdateTime;
  const profilesSinceLastUpdate = currentCount - lastCount;
  const rate = profilesSinceLastUpdate / (timeSinceLastUpdate / 1000); // profiles per second

  const remaining = EXPECTED_GUEST_COUNT - currentCount;
  const etaSeconds = rate > 0 ? remaining / rate : 0;
  const etaMinutes = Math.floor(etaSeconds / 60);
  const etaSecondsRemainder = Math.floor(etaSeconds % 60);

  const etaStr = etaMinutes > 0
    ? `~${etaMinutes}m ${etaSecondsRemainder}s`
    : `~${etaSecondsRemainder}s`;

  console.log(`  📊 Progress: ${currentCount}/${EXPECTED_GUEST_COUNT} (${percentage}%) | +${newThisCycle} new | ETA: ${etaStr}`);

  lastUpdateTime = Date.now();
  lastCount = currentCount;
}

/**
 * Extract profile data from a guest element
 */
async function extractProfileData(linkElement) {
  const href = await linkElement.getAttribute('href');
  if (!href || !href.startsWith('/u/')) {
    return null;
  }

  const fullUrl = `https://cerebralvalley.ai${href}`;

  // Extract name from the link text
  const nameElement = linkElement.locator('.truncate, .text-sm, p, span').first();
  let name = 'Unknown';
  try {
    name = (await nameElement.textContent({ timeout: 1000 }))?.trim() || 'Unknown';
  } catch (error) {
    // Name extraction failed, keep default
  }

  // Try to extract avatar/profile picture
  let avatar = null;
  try {
    const imgElement = linkElement.locator('img').first();
    avatar = await imgElement.getAttribute('src', { timeout: 1000 });
  } catch (error) {
    // No avatar found
  }

  // Try to extract any additional metadata (title, company, etc.)
  const metadata = {};
  try {
    const parentContainer = linkElement.locator('..').locator('..');
    const textElements = await parentContainer.locator('p, span').all();

    for (let i = 0; i < Math.min(textElements.length, 3); i++) {
      const text = (await textElements[i].textContent())?.trim();
      if (text && text !== name && text.length < 100) {
        metadata[`field_${i}`] = text;
      }
    }
  } catch (error) {
    // Metadata extraction failed
  }

  return {
    url: fullUrl,
    name: name,
    avatar: avatar,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    username: href.replace('/u/', '')
  };
}

/**
 * Main scraping function
 */
async function scrapeGuestList() {
  console.log('=== Cerebral Valley Guest List Scraper ===\n');

  // Check for authentication
  if (!fs.existsSync(AUTH_FILE_PATH)) {
    console.error('✗ Authentication file not found at', AUTH_FILE_PATH);
    console.error('  Please run "node login.js" first to authenticate.\n');
    process.exit(1);
  }

  // Load any existing progress
  const checkpoint = loadProgress();
  const profilesMap = new Map();
  const existingUrls = new Set();

  // Load existing profiles into map
  for (const profile of checkpoint.profiles) {
    profilesMap.set(profile.url, profile);
    existingUrls.add(profile.url);
  }

  console.log('Launching Chrome browser with Patchright (headed mode with 1920x1080)...');

  // Use Patchright's best practice for undetected scraping
  // Running in headed mode to avoid headless detection
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    channel: 'chrome',        // Use real Chrome
    headless: false,          // Run headed to avoid detection
    viewport: { width: 1920, height: 1080 },  // Full HD viewport
    // DO NOT add custom userAgent or headers
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles'
  });

  try {
    // Load the saved authentication state on top of persistent context
    // This combines persistent profile with our saved cookies
    if (fs.existsSync(AUTH_FILE_PATH)) {
      const authState = JSON.parse(fs.readFileSync(AUTH_FILE_PATH, 'utf8'));

      // Get or create the first page
      const page = context.pages()[0] || await context.newPage();

      // Manually set cookies from auth state
      if (authState.cookies && authState.cookies.length > 0) {
        await context.addCookies(authState.cookies);
        console.log(`✓ Loaded ${authState.cookies.length} cookies from authentication state`);
      }

      // Set localStorage if available
      if (authState.origins && authState.origins.length > 0) {
        for (const origin of authState.origins) {
          if (origin.localStorage) {
            await page.goto(origin.origin);
            for (const item of origin.localStorage) {
              await page.evaluate(
                ({ name, value }) => localStorage.setItem(name, value),
                item
              );
            }
          }
        }
      }
    }

    const page = context.pages()[0] || await context.newPage();

    console.log(`Navigating to: ${TARGET_URL}`);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });

    // Wait for guest list to load
    console.log('Waiting for guest list to load...');
    try {
      await page.waitForSelector(SCROLLABLE_SELECTOR, { timeout: 30000 });
    } catch (error) {
      console.error('✗ Could not find guest list container.');
      console.error('  Possible reasons:');
      console.error('  - You are not registered for the event');
      console.error('  - You do not have access to the guest list');
      console.error('  - The page structure has changed');
      console.error('  - Authentication session expired (try running login.js again)\n');

      // Take a screenshot for debugging
      const screenshotPath = path.join(path.dirname(new URL(import.meta.url).pathname), 'debug-screenshot.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.error(`  Debug screenshot saved to: ${path.basename(screenshotPath)}\n`);

      await context.close();
      process.exit(1);
    }

    const scrollableElement = page.locator(SCROLLABLE_SELECTOR);

    console.log('\nStarting incremental scroll and scrape...\n');
    startTime = Date.now();
    lastUpdateTime = startTime;
    lastCount = profilesMap.size;

    let previousSize = -1;
    let consecutiveNoChange = 0;

    // Main scraping loop with incremental scrolling
    while (consecutiveNoChange < MAX_CONSECUTIVE_NO_CHANGE) {
      previousSize = profilesMap.size;

      // Scroll incrementally (500px chunks - balanced speed)
      const scrollInfo = await scrollIncrementally(scrollableElement, SCROLL_INCREMENT_PX);

      // Wait for content to render (longer wait if near bottom)
      const waitTime = scrollInfo.atBottom ? SCROLL_WAIT_MS * 2 : SCROLL_WAIT_MS;
      await sleep(waitTime);

      // Get all visible guest links
      await withRetry(async () => {
        const visibleLinks = await scrollableElement.locator(GUEST_ITEM_SELECTOR).all();

        // Extract data from each link
        for (const link of visibleLinks) {
          try {
            const profileData = await extractProfileData(link);
            if (profileData && !profilesMap.has(profileData.url)) {
              profilesMap.set(profileData.url, profileData);
            }
          } catch (error) {
            // Skip this profile if extraction fails
            continue;
          }
        }
      }, 'Profile extraction');

      const newProfiles = profilesMap.size - previousSize;

      if (newProfiles > 0) {
        consecutiveNoChange = 0;
        displayProgress(profilesMap.size, newProfiles);

        // Save checkpoint periodically
        if (profilesMap.size % CHECKPOINT_INTERVAL === 0) {
          saveProgress(Array.from(profilesMap.values()));
          console.log('  💾 Checkpoint saved');
        }
      } else {
        // Check if we're truly at the bottom before giving up
        if (scrollInfo.atBottom) {
          // At bottom with no new profiles - check for DOM mutations
          const hadMutations = await waitForDOMChanges(scrollableElement, DOM_SETTLE_MS);

          if (!hadMutations) {
            consecutiveNoChange++;
            console.log(`  ⏳ No new profiles (${consecutiveNoChange}/${MAX_CONSECUTIVE_NO_CHANGE}) | Total: ${profilesMap.size}`);
          } else {
            console.log(`  ⏳ DOM still loading... waiting`);
          }
        } else {
          // Not at bottom yet, keep scrolling fast
          if (profilesMap.size % 10 === 0) {
            console.log(`  📜 Scrolling... ${profilesMap.size} profiles found`);
          }
        }
      }
    }

    console.log('\n=== Scraping Complete ===');
    console.log(`✓ Found ${profilesMap.size} unique profiles`);

    // Convert map to array and sort by username
    const results = Array.from(profilesMap.values()).sort((a, b) =>
      a.username.localeCompare(b.username)
    );

    // Save final results
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
    console.log(`✓ Results saved to ${path.basename(OUTPUT_FILE)}`);

    // Clean up progress file
    if (fs.existsSync(PROGRESS_FILE_PATH)) {
      fs.unlinkSync(PROGRESS_FILE_PATH);
      console.log('✓ Checkpoint file cleaned up');
    }

    // Validation
    const difference = EXPECTED_GUEST_COUNT - profilesMap.size;
    if (Math.abs(difference) > 20) {
      console.log(`\n⚠ Warning: Expected ~${EXPECTED_GUEST_COUNT} profiles but found ${profilesMap.size}`);
      console.log(`  Difference: ${difference > 0 ? 'Missing' : 'Extra'} ${Math.abs(difference)} profiles`);
      console.log('  This could be due to:');
      console.log('  - Guest list changes since the expected count was set');
      console.log('  - Access restrictions on some profiles');
      console.log('  - Page structure changes\n');
    } else {
      console.log(`✓ Profile count matches expected (~${EXPECTED_GUEST_COUNT})\n`);
    }

    await context.close();

  } catch (error) {
    console.error('\n✗ Scraping failed:', error.message);
    console.error('\nStack trace:', error.stack);

    // Save progress before exiting
    if (profilesMap.size > 0) {
      console.log('\nSaving progress before exit...');
      saveProgress(Array.from(profilesMap.values()));
      console.log(`✓ Saved ${profilesMap.size} profiles to checkpoint`);
      console.log('  Run this script again to resume from where it left off.\n');
    }

    await context.close();
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n\nScraping cancelled by user.');
  process.exit(0);
});

scrapeGuestList();

```