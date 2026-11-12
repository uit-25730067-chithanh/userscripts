const { chromium } = require('/Users/tcdtist/dev/aceteam/discord-aceteam/discord-bot-dashboard/node_modules/playwright');
const fs = require('fs');
const path = require('path');

async function runTest() {
  console.log('🚀 [Test] Starting Harvester v1.2.0 verification with Playwright...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Create a realistic mock HTML with SPA navigation
  const mockHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Teams and Channels | SS009.G11.CN1.CNTT - Chủ nghĩa xã hội khoa học - ThS. Trần Thị Hoài Thương | General | Microsoft Teams</title>
  </head>
  <body>
    <!-- Navigation simulating SPA views -->
    <div id="nav-bar">
      <button id="nav-calendar" onclick="switchView('calendar')">Calendar</button>
      <button id="nav-channel" onclick="switchView('channel')">Channel Replies</button>
    </div>

    <!-- Main Container -->
    <div id="main-view">
      <div id="channel-content">
        <!-- Team avatar with subject code -->
        <div data-tid="channel-title-avatar">
          <img src="https://teams.cloud.microsoft/api/profile?displayName=SS009.G11.CN1.CNTT%20-%20Ch%E1%BB%A7%20ngh%C4%A9a%20x%C3%A3%20h%E1%BB%99i%20khoa%20h%E1%BB%8Dc%20-%20ThS.%20Tr%E1%BA%A7n%20Th%E1%BB%8B%20Ho%C3%A0i%20Th%C6%B0%C6%A1ng" />
        </div>
        <h2 data-tid="channelTitle-text">General</h2>
        <h3 data-tid="postTitle-text">Buổi 1</h3>
        <button data-tid="close-l2-view-button">Go to channel</button>

        <div data-tid="channel-replies-viewport" style="height: 300px; overflow-y: scroll;">
          <div data-tid="channel-replies-runway">
            <div data-tid="channel-replies-pane-message" class="msg">
              <span id="author-1792849057883">Hà Minh Phụng</span>
              <time>8:37 PM</time>
              <div id="message-body-1792849057883" data-mid="1792849057883" data-tid="message-body">dạ em chào cô</div>
            </div>
            <div data-tid="channel-replies-pane-message" class="msg">
              <span id="author-1792849058451">Nguyễn Đức Trung</span>
              <time>8:37 PM</time>
              <div id="message-body-1792849058451" data-mid="1792849058451" data-tid="message-body">e chào cô ạ</div>
            </div>
            <div data-tid="channel-replies-pane-message" class="msg">
              <span id="author-1792849058897">Võ Trần Trung</span>
              <time>8:37 PM</time>
              <div id="message-body-1792849058897" data-mid="1792849058897" data-tid="message-body">dạ e chào cô</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <script>
      function switchView(view) {
        const main = document.getElementById('main-view');
        if (view === 'calendar') {
          main.innerHTML = '<h1>Calendar View (No messages)</h1>';
        } else {
          location.reload();
        }
      }
    </script>
  </body>
  </html>
  `;

  await page.setContent(mockHtml);

  // Read and inject the userscript
  const scriptPath = path.resolve(__dirname, '../scripts/teams-lecture-comments-harvester.user.js');
  const scriptContent = fs.readFileSync(scriptPath, 'utf8');

  await page.evaluate(scriptContent);

  // 1. Verify button is mounted and visible
  const harvesterRoot = await page.$('#teams-lecture-comments-harvester-root');
  if (!harvesterRoot) throw new Error('Harvester root element not found!');

  const isVisibleInitial = await page.evaluate(() => {
    const root = document.getElementById('teams-lecture-comments-harvester-root');
    return root && root.style.display !== 'none';
  });
  console.log('✅ [1] In channel view -> Harvester button visible:', isVisibleInitial);
  if (!isVisibleInitial) throw new Error('Button should be visible in channel view');

  // 2. Verify button style (white background, purple text)
  const buttonStyle = await page.evaluate(() => {
    const root = document.getElementById('teams-lecture-comments-harvester-root');
    const btn = root.shadowRoot.querySelector('#tlch-trigger-btn');
    const computed = window.getComputedStyle(btn);
    return {
      bg: computed.backgroundColor,
      color: computed.color,
      cursor: computed.cursor,
      text: btn.innerText.trim()
    };
  });
  console.log('✅ [2] Button Styles:', buttonStyle);
  // rgb(255, 255, 255) is white, rgb(91, 95, 199) is #5b5fc7
  if (buttonStyle.bg !== 'rgb(255, 255, 255)') throw new Error('Background must be #ffffff');
  if (buttonStyle.color !== 'rgb(91, 95, 199)') throw new Error('Color must be #5b5fc7');

  // 3. Verify filename detection
  const detectedFilename = await page.evaluate(() => {
    return window.__teamsCommentsHarvester.detectSessionFilename();
  });
  console.log('✅ [3] Auto-detected filename:', detectedFilename);
  if (detectedFilename !== 'ss009_buoi_01_comments.csv') {
    throw new Error(`Expected ss009_buoi_01_comments.csv, got: ${detectedFilename}`);
  }

  // 4. Test dragging
  await page.evaluate(() => {
    const root = document.getElementById('teams-lecture-comments-harvester-root');
    const btn = root.shadowRoot.querySelector('#tlch-trigger-btn');
    btn.dispatchEvent(new MouseEvent('mousedown', { clientX: 500, clientY: 500, button: 0, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 400, clientY: 400, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mouseup', { clientX: 400, clientY: 400, bubbles: true }));
  });

  const positionAfterDrag = await page.evaluate(() => {
    const root = document.getElementById('teams-lecture-comments-harvester-root');
    const btn = root.shadowRoot.querySelector('#tlch-trigger-btn');
    return { left: btn.style.left, top: btn.style.top };
  });
  console.log('✅ [4] Draggability -> New position after drag:', positionAfterDrag);
  if (!positionAfterDrag.left || !positionAfterDrag.top) throw new Error('Position should be updated after drag');

  // 5. Test SPA view switching (switch to Calendar -> button MUST disappear)
  await page.evaluate(() => {
    document.getElementById('nav-calendar').click();
  });
  // Wait 600ms for visibilityInterval to detect
  await page.waitForTimeout(650);

  // 6. Verify version and exposed API
  const apiCheck = await page.evaluate(() => {
    return {
      version: window.__teamsCommentsHarvester.version,
      hasExtractIdb: typeof window.__teamsCommentsHarvester.extractFromIndexedDB === 'function',
      hasExportCSV: typeof window.__teamsCommentsHarvester.exportCSV === 'function',
      hasStartHarvest: typeof window.__teamsCommentsHarvester.startHarvest === 'function',
      hasResetHarvestState: typeof window.__teamsCommentsHarvester.resetHarvestState === 'function',
      hasRenderButton: typeof window.__teamsCommentsHarvester.renderButton === 'function'
    };
  });
  console.log('✅ [6] Exposed API checks:', apiCheck);
  if (apiCheck.version !== '1.5.0') throw new Error(`Expected version 1.5.0, got ${apiCheck.version}`);
  if (!apiCheck.hasExtractIdb) throw new Error('extractFromIndexedDB must be exposed');
  if (!apiCheck.hasResetHarvestState) throw new Error('resetHarvestState must be exposed');

  // 7. Verify dynamic progress counter formatting: (count/total)
  const progressTextWithTotal = await page.evaluate(() => {
    window.__teamsCommentsHarvester.renderButton('harvesting', 123, 1756);
    const root = document.getElementById('teams-lecture-comments-harvester-root');
    const btn = root.shadowRoot.querySelector('#tlch-trigger-btn');
    return btn.innerText.trim();
  });
  console.log('✅ [7] Dynamic progress counter (with total):', progressTextWithTotal);
  if (progressTextWithTotal !== 'Đang cào (123/1756)...') {
    throw new Error(`Expected 'Đang cào (123/1756)...', got '${progressTextWithTotal}'`);
  }

  const progressTextWithoutTotal = await page.evaluate(() => {
    window.__teamsCommentsHarvester.renderButton('harvesting', 45, 0);
    const root = document.getElementById('teams-lecture-comments-harvester-root');
    const btn = root.shadowRoot.querySelector('#tlch-trigger-btn');
    return btn.innerText.trim();
  });
  console.log('✅ [7b] Dynamic progress counter (without total fallback):', progressTextWithoutTotal);
  if (progressTextWithoutTotal !== 'Đang cào (45)...') {
    throw new Error(`Expected 'Đang cào (45)...', got '${progressTextWithoutTotal}'`);
  }

  // 8. Test state reset
  const resetCheck = await page.evaluate(() => {
    window.__teamsCommentsHarvester.resetHarvestState();
    const root = document.getElementById('teams-lecture-comments-harvester-root');
    const btn = root.shadowRoot.querySelector('#tlch-trigger-btn');
    return btn.innerText.trim();
  });
  console.log('✅ [8] resetHarvestState -> Button reset to idle:', resetCheck);
  if (resetCheck !== 'Tải comment') {
    throw new Error(`Expected 'Tải comment' after reset, got '${resetCheck}'`);
  }

  // 9. Test filename detection with inferredLessonSlug
  const inferredFilename = await page.evaluate(() => {
    return window.__teamsCommentsHarvester.detectSessionFilename({
      inferredLessonSlug: 'buoi_02'
    });
  });
  console.log('✅ [9] Inferred slug filename detection:', inferredFilename);
  if (inferredFilename !== 'ss009_buoi_02_comments.csv') {
    throw new Error(`Expected 'ss009_buoi_02_comments.csv', got '${inferredFilename}'`);
  }

  // 10. Test DOM fallback scroll-to-0 and spinner patience
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head><title>Teams and Channels | SS008 | General | Microsoft Teams</title></head>
    <body>
      <div data-tid="message-pane-body">
        <h3 data-tid="postTitle-text">Buổi 4</h3>
        <div role="progressbar" id="mock-spinner">Loading earlier...</div>
        <div data-tid="channel-replies-viewport" style="height: 200px; overflow-y: scroll;">
          <div data-tid="channel-replies-runway" style="height: 2000px;">
            <div data-tid="channel-replies-pane-message" class="msg">
              <span id="author-1794483000001">Student A</span>
              <time>7:30 PM</time>
              <div data-mid="1794483000001" data-tid="message-body">Comment 2</div>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `);
  await page.evaluate(scriptContent);
  await page.evaluate(() => {
    const vp = document.querySelector('[data-tid="channel-replies-viewport"]');
    vp.scrollTop = 1200;
    window.__teamsCommentsHarvester.startHarvest();
  });
  // Wait ~1.5s while spinner is active: must scroll to 0 and MUST NOT have exported yet
  await page.waitForTimeout(1600);
  const midHarvestState = await page.evaluate(() => ({
    scrollTop: document.querySelector('[data-tid="channel-replies-viewport"]').scrollTop,
    lastExport: window.__teamsCommentsHarvester.lastExport
  }));
  console.log('✅ [10a] Spinner active -> scrolled to top & waiting:', midHarvestState);
  if (midHarvestState.scrollTop !== 0) throw new Error(`Expected scrollTop=0, got ${midHarvestState.scrollTop}`);
  if (midHarvestState.lastExport !== null) throw new Error('Should NOT stop & export while spinner is visible');

  // Inject earlier message (6:30 PM) and remove spinner, then verify export includes it
  await page.evaluate(() => {
    document.getElementById('mock-spinner').remove();
    const runway = document.querySelector('[data-tid="channel-replies-runway"]');
    const older = document.createElement('div');
    older.setAttribute('data-tid', 'channel-replies-pane-message');
    const a = document.createElement('span');
    a.id = 'author-1794482000000';
    a.textContent = 'Student B';
    const t = document.createElement('time');
    t.textContent = '6:30 PM';
    const b = document.createElement('div');
    b.setAttribute('data-mid', '1794482000000');
    b.setAttribute('data-tid', 'message-body');
    b.textContent = 'Comment 1';
    older.append(a, t, b);
    runway.prepend(older);
  });

  // Wait up to 14s for 24 stale ticks (~10.8s)
  let finalExport = null;
  for (let i = 0; i < 30; i++) {
    finalExport = await page.evaluate(() => window.__teamsCommentsHarvester.lastExport);
    if (finalExport) break;
    await page.waitForTimeout(500);
  }
  console.log('✅ [10b] Spinner cleared -> completed DOM fallback export:', finalExport);
  if (!finalExport || finalExport.count !== 2) {
    throw new Error(`Expected 2 comments exported after spinner cleared, got ${JSON.stringify(finalExport)}`);
  }

  console.log('🎉 ALL PLAYWRIGHT CHECKS PASSED PERFECTLY!');
  await browser.close();
}

runTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
