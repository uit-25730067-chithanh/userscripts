// ==UserScript==
// @name         Teams Lecture Comments Harvester
// @namespace    https://github.com/uit-25730067-chithanh
// @version      1.3.0
// @description  Compact, zero-click read-only comment & reaction harvester for Microsoft Teams lectures (Hybrid IndexedDB + DOM, Exports 9-column CSV)
// @author       uit-25730067-chithanh
// @match        https://teams.cloud.microsoft/*
// @match        https://teams.microsoft.com/*
// @icon         https://teams.microsoft.com/favicon.ico
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/**
 * TEAMS LECTURE COMMENTS & REACTIONS HARVESTER (UIT) - ZERO-CLICK COMPACT FLUENT UI
 * ==============================================================================
 * SPECIFICATION & SAFETY GUARANTEES:
 * 1. COMPACT CORNER BUTTON: Neat, single MS Teams Fluent UI button in the corner.
 * 2. HYBRID INDEXEDDB + DOM HARVESTER: Extracts full reply chains & authoritative emotions from IndexedDB with DOM fallback.
 * 3. TRUSTED-TYPES / CSP IMMUNE: 100% pure DOM node construction & DOMParser (Zero innerHTML).
 * 4. ZERO-MUTATION & READ-ONLY: Never invokes .click() on reaction elements.
 * 5. REACT FIBER & PROPS SNIFFER: Extracts reactor names directly from RAM.
 * 6. PASSIVE FETCH INTERCEPTOR: Hooks window.fetch to capture reaction payloads.
 * 7. SAFE VIRTUAL HOVER: Uses pointerenter/mouseover to trigger tooltips without sending requests.
 * 8. ACCURATE QUOTE SEPARATION: Isolates replies, original authors, times, and contents.
 * 9. ZERO-RELOAD HOT-SWAP: Injects cleanly into live Teams calls without page reload.
 * 10. 9-COLUMN UTF-8 BOM CSV: Auto-detects lecture name and downloads <session>_comments.csv.
 * ==============================================================================
 */

(function initTeamsLectureCommentsHarvester() {
  'use strict';

  // --- Hot-Swap: Destroy any previous instance cleanly without reloading ---
  if (window.__teamsCommentsHarvester && typeof window.__teamsCommentsHarvester.destroy === 'function') {
    try {
      window.__teamsCommentsHarvester.destroy();
      console.log('%c[Teams Harvester] Hot-swapped: Previous instance cleaned up.', 'color: #107c10; font-weight: 600;');
    } catch (e) {
      console.warn('[Teams Harvester] Cleanup warning:', e);
    }
  }

  const ROOT_ID = 'teams-lecture-comments-harvester-root';
  const oldRoot = document.getElementById(ROOT_ID);
  if (oldRoot) oldRoot.remove();

  // --- Global State ---
  const commentMap = new Map();
  const networkReactionMap = new Map(); // mid -> "❤️: Nguyen Van A | 👍: Tran Van B"
  let isHarvesting = false;
  let totalInspectedPills = 0;
  let harvestInterval = null;
  let consecutiveStaleTicks = 0;
  let lastCommentCount = 0;
  let lastScrollHeight = 0;
  let tickCounter = 0;
  let cachedIdbCount = 0;

  // --- 1. Passive Network Interceptor (100% Read-Only) ---
  if (!window.__tlch_fetch_hooked) {
    window.__tlch_fetch_hooked = true;
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      const response = await originalFetch.apply(this, args);
      try {
        const url = (typeof args[0] === 'string' ? args[0] : args[0]?.url) || '';
        if (url.includes('/messages') || url.includes('chatsvcagg') || url.includes('/conversations')) {
          const clone = response.clone();
          clone.json().then(data => {
            const msgs = data.messages || (Array.isArray(data) ? data : []);
            msgs.forEach(m => {
              if (m.id && Array.isArray(m.reactions) && m.reactions.length > 0) {
                const grouped = new Map();
                m.reactions.forEach(r => {
                  const emoji = normalizeEmoji(r.reactionType || r.key || '');
                  const name = r.user?.displayName || r.userProfile?.displayName || r.userName || '';
                  if (emoji && name) {
                    if (!grouped.has(emoji)) grouped.set(emoji, new Set());
                    grouped.get(emoji).add(name);
                  }
                });
                if (grouped.size > 0) {
                  const parts = [];
                  grouped.forEach((users, emoji) => {
                    parts.push(`${emoji}: ${Array.from(users).join(', ')}`);
                  });
                  networkReactionMap.set(String(m.id), parts.join(' | '));
                }
              }
            });
          }).catch(() => {});
        }
      } catch (e) {}
      return response;
    };
  }

  // --- 2. Emoji Normalization ---
  function normalizeEmoji(raw) {
    if (!raw) return '';
    const lower = raw.toLowerCase().trim();
    if (lower.includes('heart') || lower.includes('tim') || lower.includes('love') || lower.includes('yêu thích')) return '❤️';
    if (lower.includes('like') || lower.includes('thích') || lower.includes('thumbs up')) return '👍';
    if (lower.includes('laugh') || lower.includes('cười') || lower.includes('haha') || lower.includes('smile')) return '😆';
    if (lower.includes('surprised') || lower.includes('ngạc nhiên') || lower.includes('wow') || lower.includes('ồ')) return '😮';
    if (lower.includes('sad') || lower.includes('buồn') || lower.includes('khóc') || lower.includes('crying')) return '😢';
    if (lower.includes('angry') || lower.includes('tức giận') || lower.includes('phẫn nộ') || lower.includes('giận')) return '😡';
    if (lower.includes('vỗ tay') || lower.includes('clap') || lower.includes('applause')) return '👏';
    if (lower.includes('lửa') || lower.includes('fire') || lower.includes('cháy')) return '🔥';
    if (lower.includes('tiệc') || lower.includes('party') || lower.includes('chúc mừng') || lower.includes('tada')) return '🎉';
    if (lower.includes('100') || lower.includes('tròn')) return '💯';
    if (lower.includes('check') || lower.includes('đồng ý') || lower.includes('đúng')) return '✅';
    const match = raw.match(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u);
    return match ? match[0] : '';
  }

  // --- 3. Message ID (MID) Detection ---
  function findMessageId(el) {
    if (!el) return null;
    const ariaLabels = [el.getAttribute('aria-labelledby'), el.getAttribute('id'), el.parentElement?.getAttribute('id')].filter(Boolean).join(' ');
    const idMatch = ariaLabels.match(/\b\d{12,14}\b/);
    if (idMatch) return idMatch[0];

    const direct = el.closest('[data-mid]');
    if (direct && direct.getAttribute('data-mid')) return direct.getAttribute('data-mid');

    const msgContainer = el.closest(
      '[data-tid="channel-replies-pane-message"], [data-tid="chat-pane-message"], [data-tid*="message"], .ui-chat__item, [role="listitem"]'
    );
    if (msgContainer) {
      if (msgContainer.getAttribute('data-mid')) return msgContainer.getAttribute('data-mid');
      const innerMid = msgContainer.querySelector('[data-mid]');
      if (innerMid && innerMid.getAttribute('data-mid')) return innerMid.getAttribute('data-mid');
      const bodyWithId = msgContainer.querySelector('[id*="message-body-"], [id*="author-"]');
      if (bodyWithId) {
        const m = bodyWithId.id.match(/\b\d{12,14}\b/);
        if (m) return m[0];
      }
    }

    let parent = el.parentElement;
    for (let depth = 0; depth < 5 && parent; depth++) {
      const midEl = parent.querySelector('[data-mid]');
      if (midEl && midEl.getAttribute('data-mid')) return midEl.getAttribute('data-mid');
      const bId = parent.querySelector('[id*="message-body-"], [id*="author-"]');
      if (bId) {
        const m = bId.id.match(/\b\d{12,14}\b/);
        if (m) return m[0];
      }
      parent = parent.parentElement;
    }
    return null;
  }

  // --- 4. Reactor Extraction from React Fiber / Props ---
  function extractDetailsFromReact(btn, itemNode) {
    const targets = [btn, itemNode].filter(Boolean);
    for (const el of targets) {
      try {
        const propsKey = Object.keys(el).find(k => k.startsWith('__reactProps'));
        if (propsKey && el[propsKey]) {
          const p = el[propsKey];
          const rx = p.reaction || p.children?.[1]?.props?.reaction || p.children?.props?.reaction;
          if (rx) {
            const users = rx.users || rx.userProfiles || rx.reactors || [];
            if (Array.isArray(users) && users.length > 0) {
              const names = users.map(u => u.displayName || u.name || '').filter(Boolean);
              if (names.length > 0) {
                const emoji = normalizeEmoji(rx.commonKey || rx.reactionType || '') || '❤️';
                return `${emoji}: ${names.join(', ')}`;
              }
            }
          }
        }

        const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber'));
        if (fiberKey && el[fiberKey]) {
          let fiber = el[fiberKey];
          let depth = 0;
          while (fiber && depth < 20) {
            const mProps = fiber.memoizedProps;
            if (mProps) {
              const msg = mProps.message || mProps.item;
              if (msg && Array.isArray(msg.reactions) && msg.reactions.length > 0) {
                const grouped = new Map();
                msg.reactions.forEach(r => {
                  const emoji = normalizeEmoji(r.reactionType || r.commonKey || '');
                  const name = r.user?.displayName || r.userProfile?.displayName || r.userName || '';
                  if (emoji && name) {
                    if (!grouped.has(emoji)) grouped.set(emoji, new Set());
                    grouped.get(emoji).add(name);
                  }
                });
                if (grouped.size > 0) {
                  const parts = [];
                  grouped.forEach((users, emoji) => {
                    parts.push(`${emoji}: ${Array.from(users).join(', ')}`);
                  });
                  return parts.join(' | ');
                }
              }
            }
            fiber = fiber.return;
            depth++;
          }
        }
      } catch (e) {}
    }
    return null;
  }

  // --- 5. Reactor Extraction from Aria-label ---
  function extractFromAria(btn) {
    const aria = btn.getAttribute('aria-label') || btn.getAttribute('title') || '';
    if (!aria) return null;
    const match = aria.match(/[:：]\s*(.+)$/);
    if (match && match[1]) {
      const names = match[1].split(/,| and | và /).map(s => s.trim()).filter(Boolean);
      if (names.length > 0) {
        const emoji = normalizeEmoji(aria) || '❤️';
        return `${emoji}: ${names.join(', ')}`;
      }
    }
    return null;
  }

  // --- 6. Safe Virtual Hover (Zero-Click) ---
  async function inspectViaHover(btn) {
    try {
      btn.scrollIntoView({ behavior: 'auto', block: 'nearest' });
      const rect = btn.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;

      const eventInit = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
        screenX: x,
        screenY: y,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
        relatedTarget: btn.parentElement
      };

      const targets = [btn, btn.querySelector('img, span, div')].filter(Boolean);
      targets.forEach(t => {
        t.dispatchEvent(new PointerEvent('pointerover', eventInit));
        t.dispatchEvent(new MouseEvent('mouseover', eventInit));
        t.dispatchEvent(new PointerEvent('pointerenter', eventInit));
        t.dispatchEvent(new MouseEvent('mouseenter', eventInit));
      });

      let menu = null;
      const menuSelectors = [
        '[role="menu"]',
        '.fui-MenuPopover',
        '[role="dialog"]',
        '[data-tid*="reaction-flyout"]',
        '[data-tid*="popover"]'
      ];

      for (let i = 0; i < 9; i++) {
        await new Promise(r => setTimeout(r, 40));
        menu = document.querySelector(menuSelectors.join(', '));
        if (menu && menu.innerText.trim()) break;
      }

      let detail = null;
      if (menu) {
        const rawText = menu.innerText.trim();
        const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length > 0) {
          const firstLine = lines[0];
          const emoji = normalizeEmoji(firstLine) || normalizeEmoji(btn.getAttribute('aria-label') || '') || '❤️';
          const names = lines.slice(1).filter(l =>
            !normalizeEmoji(l) &&
            !l.toLowerCase().includes('reaction') &&
            !l.toLowerCase().includes('phản ứng')
          );
          if (names.length > 0) {
            detail = `${emoji}: ${names.join(', ')}`;
          } else {
            detail = `${emoji}: ${lines.join(', ')}`;
          }
        }
      }

      targets.forEach(t => {
        t.dispatchEvent(new PointerEvent('pointerout', eventInit));
        t.dispatchEvent(new MouseEvent('mouseout', eventInit));
        t.dispatchEvent(new PointerEvent('pointerleave', eventInit));
        t.dispatchEvent(new MouseEvent('mouseleave', eventInit));
      });

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));

      return detail;
    } catch (e) {
      return null;
    }
  }

  // --- 7. Basic Reactions (Emoji + Count) ---
  function extractBasicReactions(item) {
    const reactions = [];
    const pillSelectors = [
      '[data-tid="diverse-reaction-pill-button"]',
      '[data-tid*="reaction-pill"]',
      '.fui-ReactionGroup button',
      '[class*="ReactionGroup"] button'
    ];
    const pillButtons = item.querySelectorAll(pillSelectors.join(', '));
    const processed = new Set();

    pillButtons.forEach(btn => {
      if (processed.has(btn)) return;
      processed.add(btn);

      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (btn.matches('[data-tid*="picker"], [data-tid*="flyout"]') || aria.includes('thêm phản ứng') || aria.includes('add reaction')) {
        return;
      }

      let emoji = '';
      let count = '1';

      try {
        const propsKey = Object.keys(btn).find(k => k.startsWith('__reactProps'));
        const rx = btn[propsKey]?.children?.[1]?.props?.reaction;
        if (rx?.commonKey) {
          emoji = normalizeEmoji(rx.commonKey);
          if (rx.count) count = String(rx.count);
        }
      } catch (e) {}

      if (!emoji) {
        const img = btn.querySelector('img[alt]');
        if (img && img.getAttribute('alt')) emoji = normalizeEmoji(img.getAttribute('alt'));
      }
      if (!emoji && btn.innerText) {
        emoji = normalizeEmoji(btn.innerText);
      }
      if (!emoji && aria) {
        emoji = normalizeEmoji(aria);
      }

      if (count === '1') {
        const countEl = btn.querySelector('.fui-StyledText, span[class*="count"], [data-tid*="count"], .fui-Badge');
        if (countEl && /^\d+$/.test(countEl.innerText.trim())) {
          count = countEl.innerText.trim();
        }
      }

      if (emoji) reactions.push(`${emoji} (${count})`);
    });

    return reactions;
  }

  // --- 8. Process Single Message Node ---
  function processNode(item) {
    if (!item || !item.querySelector) return;
    if (item.querySelector('[data-tid="control-message-renderer"]')) return;
    if (item.querySelector('[data-tid="message-tombstone"]')) return;

    const mid = findMessageId(item);
    if (!mid) return;

    const reactions = extractBasicReactions(item);
    const newReactionsStr = reactions.join(', ');

    let details = networkReactionMap.get(String(mid)) || '';
    if (!details) {
      details = extractDetailsFromReact(null, item) || '';
    }
    if (!details) {
      const pillButtons = item.querySelectorAll('[data-tid="diverse-reaction-pill-button"], [data-tid*="reaction-pill"], .fui-ReactionGroup button');
      const pillDetails = [];
      pillButtons.forEach(b => {
        const d = extractFromAria(b);
        if (d) pillDetails.push(d);
      });
      if (pillDetails.length > 0) details = pillDetails.join(' | ');
    }

    if (commentMap.has(mid)) {
      const existing = commentMap.get(mid);
      if (reactions.length > 0 && existing.reactions !== newReactionsStr) {
        existing.reactions = newReactionsStr;
        existing.reactionCount = reactions.length;
      }
      if (details && !existing.reactionDetails) {
        existing.reactionDetails = details;
      }
      return;
    }

    // Author
    const authorEl = item.querySelector('[id^="author-"], [data-tid="message-author-name"]');
    let author = authorEl ? authorEl.innerText.trim() : '';
    if (!author) {
      const avatarImg = item.querySelector('[data-tid$="avatar"] img, img[aria-label*="Profile"]');
      if (avatarImg) {
        const label = avatarImg.getAttribute('aria-label') || '';
        const match = label.match(/Profile picture of (.*?)\.?$/i) || label.match(/Ảnh hồ sơ của (.*?)\.?$/i);
        author = match ? match[1] : '';
      }
    }

    // Timestamp
    const timeEl = item.querySelector('time[data-tid="timestamp"], time, [data-tid="message-timestamp"]');
    let timestamp = timeEl ? (timeEl.getAttribute('aria-label') || timeEl.innerText.trim()) : '';
    if (!timestamp && !isNaN(mid)) {
      timestamp = new Date(Number(mid)).toLocaleString('vi-VN');
    }

    // Separate Body & Reply/Quote
    const messageBody = item.querySelector('[data-tid="message-body"], [data-tid="chat-message-text"], .ui-chat__message__content');
    let isReply = 'Không';
    let replyAuthor = '';
    let replyTime = '';
    let replyContent = '';
    let actualContent = '';

    if (messageBody) {
      const quoteEl = messageBody.querySelector('blockquote, [data-tid*="quote"], [class*="quote"], [data-tid="chat-quote-renderer"]');
      if (quoteEl) {
        isReply = 'Có';
        const qAuthorEl = quoteEl.querySelector('[data-tid*="author"], [class*="author"], [class*="sender"], b, strong');
        if (qAuthorEl) replyAuthor = qAuthorEl.innerText.trim();

        const qTimeEl = quoteEl.querySelector('time, [data-tid*="time"], [class*="time"], [class*="date"]');
        if (qTimeEl) replyTime = qTimeEl.getAttribute('aria-label') || qTimeEl.innerText.trim();

        const qBodyEl = quoteEl.querySelector('[data-tid*="body"], [data-tid*="text"], [data-tid*="content"], [class*="body"], [class*="content"]');
        if (qBodyEl) {
          replyContent = qBodyEl.innerText.trim();
        } else {
          const quoteClone = quoteEl.cloneNode(true);
          const qa = quoteClone.querySelector('[data-tid*="author"], [class*="author"], [class*="sender"], b, strong');
          if (qa) qa.remove();
          const qt = quoteClone.querySelector('time, [data-tid*="time"], [class*="time"], [class*="date"]');
          if (qt) qt.remove();
          replyContent = quoteClone.innerText.trim();
        }

        const clone = messageBody.cloneNode(true);
        const quotesInClone = clone.querySelectorAll('blockquote, [data-tid*="quote"], [class*="quote"], [data-tid="chat-quote-renderer"]');
        quotesInClone.forEach(q => q.remove());
        actualContent = clone.innerText.trim();
      } else {
        actualContent = messageBody.innerText.trim();
      }

      const imgEl = messageBody.querySelector('img[data-orig-src], img[alt*="GIF"], img[alt*="Ảnh"], img[alt*="gif"], [data-tid*="image"] img');
      if (!actualContent && imgEl) {
        actualContent = `[Ảnh/GIF: ${imgEl.getAttribute('alt') || 'Image'}]`;
      }
    }

    if (actualContent || reactions.length > 0 || isReply === 'Có') {
      commentMap.set(mid, {
        mid: Number(mid),
        time: timestamp,
        author: author,
        isReply: isReply,
        replyAuthor: replyAuthor,
        replyTime: replyTime,
        replyContent: replyContent,
        content: actualContent,
        reactions: newReactionsStr,
        reactionDetails: details,
        reactionCount: reactions.length
      });
    }
  }

  // --- 9. Scan Active DOM ---
  function scanCurrentDOM() {
    const itemSelectors = [
      '[data-tid="channel-replies-pane-message"]',
      '[data-tid="chat-pane-message"]',
      '[data-mid]'
    ];
    document.querySelectorAll(itemSelectors.join(', ')).forEach(processNode);
  }

  // --- 10. Session Filename & Slug Detection ---
  function sanitizeSlug(raw) {
    if (!raw) return '';
    return raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function detectSessionFilename() {
    // 1. Detect Subject Code (e.g. SS009, CS112, IT004, SE104)
    let subjectCode = '';
    const avatarImg = document.querySelector('[data-tid="channel-title-avatar"] img, [data-tid$="avatar"] img');
    if (avatarImg && avatarImg.src) {
      try {
        const url = new URL(avatarImg.src);
        const dn = url.searchParams.get('displayName') || '';
        const match = dn.match(/\b([A-Za-z]{2,3}\d{3,4})\b/);
        if (match) subjectCode = match[1].toLowerCase();
      } catch (e) {}
    }

    if (!subjectCode && document.title) {
      const match = document.title.match(/\b([A-Za-z]{2,3}\d{3,4})\b/);
      if (match) subjectCode = match[1].toLowerCase();
    }

    if (!subjectCode) {
      const teamEl = document.querySelector('h2[data-tid="team-name"], [role="treeitem"][aria-expanded="true"] span[title]');
      if (teamEl) {
        const text = teamEl.getAttribute('title') || teamEl.innerText || '';
        const match = text.match(/\b([A-Za-z]{2,3}\d{3,4})\b/);
        if (match) subjectCode = match[1].toLowerCase();
      }
    }

    // 2. Detect Lesson / Post Title (e.g. "Buổi 1", "Buổi 01", "Lịch thi")
    let sessionTitle = '';
    const postTitleEl = document.querySelector('h3[data-tid="postTitle-text"], [data-tid="postTitle-text"]');
    if (postTitleEl && postTitleEl.innerText && postTitleEl.innerText.trim()) {
      sessionTitle = postTitleEl.innerText.trim();
    }

    if (!sessionTitle) {
      const callTitleEl = document.querySelector(
        '[data-tid="call-title"], [data-tid="meeting-title"], [data-tid="calling-header"] span, .fui-ChatHeader__title'
      );
      if (callTitleEl && callTitleEl.innerText && callTitleEl.innerText.trim()) {
        const cand = callTitleEl.innerText.trim();
        if (cand.length > 2 && !cand.toLowerCase().includes('microsoft teams')) {
          sessionTitle = cand;
        }
      }
    }

    if (!sessionTitle && document.title) {
      const parts = document.title.split('|').map(p => p.trim());
      for (const p of parts) {
        if (!p.toLowerCase().includes('teams') && !p.toLowerCase().includes('microsoft') && p.length > 2) {
          let clean = p.replace(/^(Cuộc họp trong|Meeting in)\s*['"“]/i, '').replace(/['"”]$/, '').trim();
          if (clean.length > 2) {
            sessionTitle = clean;
            break;
          }
        }
      }
    }

    // 3. Normalize Lesson / Session Slug
    let lessonSlug = '';
    if (sessionTitle) {
      const buoiMatch = sessionTitle.match(/Buổi\s*(\d+)/i) || sessionTitle.match(/Lesson\s*(\d+)/i) || sessionTitle.match(/Session\s*(\d+)/i);
      if (buoiMatch) {
        const num = parseInt(buoiMatch[1], 10);
        lessonSlug = `buoi_${num < 10 ? '0' + num : num}`;
      } else {
        lessonSlug = sanitizeSlug(sessionTitle);
      }
    }

    // 4. Combine into final filename
    if (subjectCode && lessonSlug) {
      return `${subjectCode}_${lessonSlug}_comments.csv`;
    } else if (subjectCode) {
      return `${subjectCode}_comments.csv`;
    } else if (lessonSlug) {
      return `${lessonSlug}_comments.csv`;
    }

    const today = new Date().toISOString().slice(0, 10);
    return `teams_lecture_${today}_comments.csv`;
  }

  // --- 11. SPA Target View Conditional Visibility (Zero-Pollution) ---
  function isTargetChannelView() {
    // 1. Channel reply thread (Level 2 post view)
    const hasRepliesRunway = !!document.querySelector(
      '[data-tid="channel-replies-runway"], [data-tid="channel-replies-viewport"], [data-tid="close-l2-view-button"]'
    );
    const hasRepliesMessages = document.querySelectorAll('[data-tid="channel-replies-pane-message"]').length > 0;

    // 2. Active Call Chat view
    const hasCallChat = !!document.querySelector('[data-tid="chat-pane-list"], [data-tid="chat-list"]') &&
      document.querySelectorAll('[data-tid="chat-pane-message"]').length > 0;

    // 3. Fallback: message runway with at least 2 message items
    const hasAnyMessages = document.querySelectorAll('[data-mid], [data-tid*="message-body"]').length >= 2 &&
      !!document.querySelector('[data-tid="channel-replies-runway"], [data-tid="channel-replies-viewport"], [data-tid="message-pane-layout"]');

    return hasRepliesRunway || hasRepliesMessages || hasCallChat || hasAnyMessages;
  }

  // --- 12. Pure DOM SVG Icon Builder (100% TrustedHTML / CSP Immune) ---
  function createSvgIcon(type, size = 14, color = 'currentColor') {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.style.verticalAlign = 'middle';
    svg.style.flexShrink = '0';

    if (type === 'download') {
      svg.setAttribute('viewBox', '0 0 20 20');
      svg.setAttribute('fill', color);
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', 'M10 2a.75.75 0 01.75.75v8.69l2.72-2.72a.75.75 0 111.06 1.06l-4 4a.75.75 0 01-1.06 0l-4-4a.75.75 0 111.06-1.06l2.72 2.72V2.75A.75.75 0 0110 2zM3.5 15.25a.75.75 0 01.75-.75h11.5a.75.75 0 010 1.5H4.25a.75.75 0 01-.75-.75z');
      svg.appendChild(path);
    } else if (type === 'spinner') {
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', color);
      svg.setAttribute('stroke-width', '2.5');
      svg.setAttribute('class', 'tlch-spinner');

      const circle = document.createElementNS(ns, 'circle');
      circle.setAttribute('cx', '12');
      circle.setAttribute('cy', '12');
      circle.setAttribute('r', '10');
      circle.setAttribute('stroke-opacity', '0.25');

      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', 'M12 2a10 10 0 0 1 10 10');
      path.setAttribute('stroke-linecap', 'round');

      svg.appendChild(circle);
      svg.appendChild(path);
    } else if (type === 'check') {
      svg.setAttribute('viewBox', '0 0 20 20');
      svg.setAttribute('fill', color);
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('fill-rule', 'evenodd');
      path.setAttribute('clip-rule', 'evenodd');
      path.setAttribute('d', 'M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z');
      svg.appendChild(path);
    }

    return svg;
  }

  // --- 13. Compact Fluent UI Draggable Button (MS Teams Light/Dark Theme) ---
  const container = document.createElement('div');
  container.id = ROOT_ID;
  container.style.display = isTargetChannelView() ? 'block' : 'none';
  const shadow = container.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
    }
    .tlch-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      height: 34px;
      padding: 0 14px;
      background: #ffffff;
      color: #5b5fc7;
      border: 1px solid #d1d1d1;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      cursor: grab;
      user-select: none;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.08);
      z-index: 9999999;
      transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
      white-space: nowrap;
    }
    .tlch-btn:hover {
      background: #f5f5f7;
      border-color: #5b5fc7;
      box-shadow: 0 6px 18px rgba(91, 95, 199, 0.2);
      transform: translateY(-1px);
    }
    .tlch-btn:active {
      background: #edebe9;
      transform: translateY(0);
    }
    .tlch-btn.dragging {
      cursor: grabbing !important;
      opacity: 0.92;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
      transform: none !important;
      transition: none !important;
    }
    .tlch-btn.active {
      background: #f0f4ff;
      color: #0f548c;
      border-color: #5b5fc7;
      box-shadow: 0 0 12px rgba(91, 95, 199, 0.35);
    }
    .tlch-btn.success {
      background: #f3faf3;
      color: #107c10;
      border-color: #4ade80;
    }
    .tlch-spinner {
      animation: tlch-spin 0.8s linear infinite;
    }
    @keyframes tlch-spin {
      100% { transform: rotate(360deg); }
    }
  `;

  const btn = document.createElement('button');
  btn.className = 'tlch-btn';
  btn.id = 'tlch-trigger-btn';
  btn.setAttribute('title', 'Tự động cuộn và tải file CSV comment buổi học');

  // Restore position if previously saved
  try {
    const savedPos = JSON.parse(localStorage.getItem('__tlch_btn_pos') || 'null');
    if (savedPos && typeof savedPos.left === 'number' && typeof savedPos.top === 'number') {
      const clampedLeft = Math.max(10, Math.min(window.innerWidth - 150, savedPos.left));
      const clampedTop = Math.max(10, Math.min(window.innerHeight - 50, savedPos.top));
      btn.style.left = `${clampedLeft}px`;
      btn.style.top = `${clampedTop}px`;
      btn.style.right = 'auto';
      btn.style.bottom = 'auto';
    }
  } catch (e) {}

  function renderButton(state, count = 0) {
    while (btn.firstChild) {
      btn.removeChild(btn.firstChild);
    }
    if (state === 'idle') {
      btn.className = 'tlch-btn';
      btn.appendChild(createSvgIcon('download', 14, '#5b5fc7'));
      const textSpan = document.createElement('span');
      textSpan.textContent = 'Tải comment';
      btn.appendChild(textSpan);
      btn.setAttribute('title', 'Tự động cuộn và tải file CSV comment buổi học');
    } else if (state === 'harvesting') {
      btn.className = 'tlch-btn active';
      btn.appendChild(createSvgIcon('spinner', 14, '#5b5fc7'));
      const textSpan = document.createElement('span');
      textSpan.textContent = `Đang cào (${count})...`;
      btn.appendChild(textSpan);
      btn.setAttribute('title', `Đang cào ${count} comment... Bấm để dừng và tải file CSV ngay`);
    } else if (state === 'success') {
      btn.className = 'tlch-btn success';
      btn.appendChild(createSvgIcon('check', 14, '#107c10'));
      const textSpan = document.createElement('span');
      textSpan.textContent = `Đã tải ${count} comment`;
      btn.appendChild(textSpan);
    }
  }

  renderButton('idle');

  shadow.appendChild(style);
  shadow.appendChild(btn);
  document.body.appendChild(container);

  // --- Dragging Logic (Clean separation of drag vs click) ---
  let isDragging = false;
  let dragMoved = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let initialLeft = 0;
  let initialTop = 0;

  btn.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    dragMoved = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    const rect = btn.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    btn.classList.add('dragging');

    const onMouseMove = (moveEvent) => {
      if (!isDragging) return;
      const dx = moveEvent.clientX - dragStartX;
      const dy = moveEvent.clientY - dragStartY;
      if (Math.hypot(dx, dy) > 4) {
        dragMoved = true;
      }
      const newLeft = Math.max(10, Math.min(window.innerWidth - rect.width - 10, initialLeft + dx));
      const newTop = Math.max(10, Math.min(window.innerHeight - rect.height - 10, initialTop + dy));
      btn.style.left = `${newLeft}px`;
      btn.style.top = `${newTop}px`;
      btn.style.right = 'auto';
      btn.style.bottom = 'auto';
    };

    const onMouseUp = () => {
      isDragging = false;
      btn.classList.remove('dragging');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      if (dragMoved) {
        try {
          const finalRect = btn.getBoundingClientRect();
          localStorage.setItem('__tlch_btn_pos', JSON.stringify({ left: finalRect.left, top: finalRect.top }));
        } catch (e) {}
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });

  btn.addEventListener('click', (e) => {
    if (dragMoved) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (isHarvesting) {
      stopAndExport();
    } else {
      startHarvest();
    }
  });

  // --- SPA Visibility Watcher (Zero-Pollution on other views) ---
  let visibilityInterval = setInterval(() => {
    const shouldShow = isTargetChannelView();
    if (shouldShow && container.style.display === 'none') {
      container.style.display = 'block';
    } else if (!shouldShow && container.style.display !== 'none') {
      container.style.display = 'none';
      if (isHarvesting) {
        stopHarvestWithoutExport();
      }
    }
  }, 500);

  // --- 14. Extract From Teams IndexedDB (Primary Source for Full Reply Chains & Reactions) ---
  async function extractFromIndexedDB() {
    try {
      if (typeof indexedDB === 'undefined' || !indexedDB.databases) return null;
      const dbs = await indexedDB.databases();
      const dbInfo = dbs.find(d => d.name && d.name.startsWith('Teams:replychain-manager:'));
      if (!dbInfo) return null;

      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(dbInfo.name);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      const records = await new Promise((resolve, reject) => {
        const tx = db.transaction('replychains-2', 'readonly');
        const store = tx.objectStore('replychains-2');
        const getAllReq = store.getAll();
        getAllReq.onsuccess = () => resolve(getAllReq.result || []);
        getAllReq.onerror = () => reject(getAllReq.error);
      });
      db.close();

      if (!records || records.length === 0) return null;

      // Find dom mids to identify active reply chain
      const domMids = new Set(Array.from(document.querySelectorAll('[data-mid]')).map(el => el.getAttribute('data-mid')).filter(Boolean));

      let targetRecord = null;
      let maxOverlap = 0;

      for (const rec of records) {
        let overlap = 0;
        if (domMids.has(rec.replyChainId)) overlap += 10;
        const mkeys = Object.keys(rec.messageMap || {});
        for (const k of mkeys) {
          if (domMids.has(k)) overlap++;
        }
        if (overlap > maxOverlap) {
          maxOverlap = overlap;
          targetRecord = rec;
        }
      }

      if (!targetRecord && records.length > 0) {
        // Fallback: pick record with largest messageMap
        targetRecord = records.slice().sort((a, b) => Object.keys(b.messageMap || {}).length - Object.keys(a.messageMap || {}).length)[0];
      }

      if (!targetRecord || !targetRecord.messageMap) return null;

      const msgMap = targetRecord.messageMap;
      const msgKeys = Object.keys(msgMap);
      if (msgKeys.length === 0) return null;

      // Map MRI -> Display Name
      const mriToName = new Map();
      for (const k of msgKeys) {
        const m = msgMap[k];
        if (m.creator && m.imDisplayName) mriToName.set(m.creator, m.imDisplayName);
      }

      // Sort chronologically
      msgKeys.sort((a, b) => {
        const timeA = msgMap[a].originalArrivalTime || msgMap[a].clientArrivalTime || msgMap[a].composeTime || 0;
        const timeB = msgMap[b].originalArrivalTime || msgMap[b].clientArrivalTime || msgMap[b].composeTime || 0;
        return Number(timeA) - Number(timeB);
      });

      const parser = new DOMParser();
      const rows = [];

      for (const k of msgKeys) {
        const m = msgMap[k];
        if (!m.content) continue;
        if (m.messageType === 'Control/Status' || m.messageType === 'Event/Call') continue;
        if (m.content.includes('<callEventType>')) continue;

        const timestamp = m.originalArrivalTime || m.clientArrivalTime || m.composeTime;
        const timeStr = timestamp ? new Date(Number(timestamp)).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';

        let actualContent = '';
        let isReply = 'Không';
        let replyAuthor = '';
        let replyTime = '';
        let replyContent = '';

        try {
          const doc = parser.parseFromString(m.content, 'text/html');
          const quoteEl = doc.querySelector('blockquote, [itemtype*="http://schema.skype.com/Reply"], [class*="quote"]');
          if (quoteEl) {
            isReply = 'Có';
            const qAuthor = quoteEl.querySelector('b, strong, .author');
            if (qAuthor) replyAuthor = (qAuthor.innerText || qAuthor.textContent || '').trim();
            const qTime = quoteEl.querySelector('time, .time');
            if (qTime) replyTime = (qTime.innerText || qTime.textContent || '').trim();
            replyContent = (quoteEl.textContent || '').replace(replyAuthor, '').replace(replyTime, '').trim();
            quoteEl.remove();
          }
          actualContent = (doc.body.textContent || '').trim();
        } catch (e) {
          actualContent = m.content.replace(/<[^>]+>/g, '').trim();
        }

        if (!actualContent && m.content.includes('<img')) {
          actualContent = '[Ảnh/GIF]';
        }

        let reactionsStr = '';
        let reactionDetails = '';
        if (m.properties && Array.isArray(m.properties.emotions) && m.properties.emotions.length > 0) {
          const rxCounts = [];
          const rxDets = [];
          m.properties.emotions.forEach(emo => {
            const count = emo.users ? emo.users.length : 0;
            let emoji = emo.key;
            if (emoji === 'laugh') emoji = '😆';
            else if (emoji === 'like') emoji = '👍';
            else if (emoji === 'heart') emoji = '❤️';
            else if (emoji === 'surprised') emoji = '😮';
            else if (emoji === 'sad') emoji = '😢';
            else if (emoji === 'angry') emoji = '😡';

            rxCounts.push(`${emoji} (${count})`);
            const userNames = (emo.users || []).map(u => mriToName.get(u.mri) || u.mri);
            rxDets.push(`${emoji}: ${userNames.join(', ')}`);
          });
          reactionsStr = rxCounts.join(', ');
          reactionDetails = rxDets.join(' | ');
        }

        if (actualContent || isReply === 'Có' || reactionsStr) {
          rows.push({
            mid: k,
            time: timeStr,
            author: m.imDisplayName || mriToName.get(m.creator) || 'Ẩn danh',
            isReply: isReply,
            replyAuthor: replyAuthor,
            replyTime: replyTime,
            replyContent: replyContent,
            content: actualContent,
            reactions: reactionsStr,
            reactionDetails: reactionDetails
          });
        }
      }
      return { success: true, count: rows.length, rows: rows };
    } catch (err) {
      console.warn('[Teams Harvester] IndexedDB read error:', err);
      return null;
    }
  }

  // --- 15. CSV Exporter (Hybrid IndexedDB + DOM Fallback) ---
  async function exportCSV() {
    renderButton('harvesting', Math.max(commentMap.size, cachedIdbCount));

    let results = [];

    // 1. Primary: Extract from IndexedDB (preserves full reply chain + authoritative reaction details)
    try {
      const idbData = await extractFromIndexedDB();
      if (idbData && idbData.success && idbData.rows && idbData.rows.length >= commentMap.size) {
        results = idbData.rows;
        console.log(`✅ [Teams Harvester] Primary source: Extracted ${results.length} comments from IndexedDB with full reactions.`);
      }
    } catch (idbErr) {
      console.warn('[Teams Harvester] IndexedDB extraction failed or unavailable, falling back to DOM:', idbErr);
    }

    // 2. Fallback: Extract from DOM commentMap
    if (results.length === 0) {
      scanCurrentDOM();
      results = Array.from(commentMap.values()).sort((a, b) => (a.mid || 0) - (b.mid || 0));
      console.log(`ℹ️ [Teams Harvester] Secondary source: Extracted ${results.length} comments from DOM.`);
    }

    if (results.length === 0) {
      alert('Chưa thu thập được comment nào! Vui lòng mở cuộc trò chuyện (Chat) trong Teams và thử lại.');
      renderButton('idle');
      return;
    }

    const headers = [
      'Thời gian',
      'Người gửi',
      'Là reply',
      'Reply tác giả',
      'Reply thời gian',
      'Reply nội dung gốc',
      'Nội dung',
      'Cảm xúc',
      'Chi tiết cảm xúc'
    ];

    const csvHeader = '\uFEFF' + headers.map(h => `"${h}"`).join(',') + '\n';
    const csvRows = results.map(r => {
      const escape = str => `"${(str || '').toString().replace(/"/g, '""')}"`;
      return [
        escape(r.time),
        escape(r.author),
        escape(r.isReply),
        escape(r.replyAuthor),
        escape(r.replyTime),
        escape(r.replyContent),
        escape(r.content),
        escape(r.reactions),
        escape(r.reactionDetails)
      ].join(',');
    }).join('\n');

    const downloadFileName = detectSessionFilename();

    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = downloadFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Show success feedback
    renderButton('success', results.length);

    setTimeout(() => {
      renderButton('idle');
    }, 3000);

    console.log(`📥 [Teams Harvester] Exported ${results.length} comments to ${downloadFileName}`);
  }

  // --- 16. Harvesting Cycle (Zero-Click Auto-Scroll) ---
  async function stepHarvest() {
    if (!isHarvesting) return;

    scanCurrentDOM();
    tickCounter++;

    // Periodically update IndexedDB message count in background to show live accurate counter
    if (tickCounter % 4 === 0) {
      extractFromIndexedDB().then(res => {
        if (res && res.success && res.count) {
          cachedIdbCount = res.count;
          if (isHarvesting) {
            renderButton('harvesting', Math.max(commentMap.size, cachedIdbCount));
          }
        }
      }).catch(() => {});
    }

    // Inspect reactions safely without click
    const pillButtons = Array.from(document.querySelectorAll(
      '[data-tid="diverse-reaction-pill-button"], [data-tid*="reaction-pill"], .fui-ReactionGroup button'
    )).filter(b => {
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      return !b.__tlchInspected && !b.matches('[data-tid*="picker"], [data-tid*="flyout"]') && !aria.includes('thêm phản ứng') && !aria.includes('add reaction');
    });

    for (const b of pillButtons) {
      if (!isHarvesting) break;
      b.__tlchInspected = true;
      const mid = findMessageId(b);
      if (!mid) continue;

      let detail = networkReactionMap.get(String(mid));
      if (!detail) detail = extractDetailsFromReact(b, b.closest('[data-mid]'));
      if (!detail) detail = extractFromAria(b);
      if (!detail) detail = await inspectViaHover(b);

      if (detail && commentMap.has(mid)) {
        const existing = commentMap.get(mid);
        if (!existing.reactionDetails) {
          existing.reactionDetails = detail;
        } else if (!existing.reactionDetails.includes(detail)) {
          existing.reactionDetails = `${existing.reactionDetails} | ${detail}`;
        }
        totalInspectedPills++;
      }
    }

    const currentCount = Math.max(commentMap.size, cachedIdbCount);
    renderButton('harvesting', currentCount);

    // Auto-scroll upwards in channel replies viewport or messages list
    const vp = document.querySelector('[data-tid="channel-replies-viewport"]');
    const runway = document.querySelector('[data-tid="channel-replies-runway"]');
    const scrollContainer = vp || runway;

    if (scrollContainer) {
      scrollContainer.scrollBy({ top: -750, behavior: 'auto' });
    }

    const items = document.querySelectorAll('[data-tid="channel-replies-pane-message"], [data-tid="chat-pane-message"], [data-mid]');
    if (items.length > 0) {
      items[0].scrollIntoView({ behavior: 'auto', block: 'start' });
      const scrollParent = items[0].closest('[role="log"], [role="feed"], [data-tid*="chat-list"], [data-tid*="message-list"], .fui-Chat, .ui-chat') || items[0].parentElement;
      if (scrollParent && scrollParent !== scrollContainer) {
        scrollParent.scrollBy({ top: -750, behavior: 'auto' });
      }
    }

    // Check if new comments were loaded or scrollHeight changed
    const currentScrollHeight = scrollContainer ? scrollContainer.scrollHeight : 0;
    if (currentCount === lastCommentCount && currentScrollHeight === lastScrollHeight) {
      consecutiveStaleTicks++;
    } else {
      consecutiveStaleTicks = 0;
      lastCommentCount = currentCount;
      lastScrollHeight = currentScrollHeight;
    }

    // Top detection
    const isAtTop = scrollContainer && scrollContainer.scrollTop <= 2;
    const hasPostTitle = !!document.querySelector('[data-tid="postTitle-text"]');

    // Auto-stop criteria:
    // 1. Reached top and height + comment count remained unchanged for at least 12 ticks (~5.4s)
    // 2. OR postTitle is visible AND scrollTop <= 2 AND unchanged for 6 ticks (~2.7s)
    const reachedAbsoluteTop = (isAtTop && consecutiveStaleTicks >= 12) || (hasPostTitle && isAtTop && consecutiveStaleTicks >= 6);

    if (reachedAbsoluteTop && currentCount > 0) {
      console.log('🏁 [Teams Harvester] Reached top of conversation history. Auto-exporting CSV...');
      stopAndExport();
    }
  }

  function startHarvest() {
    isHarvesting = true;
    consecutiveStaleTicks = 0;
    lastCommentCount = Math.max(commentMap.size, cachedIdbCount);
    lastScrollHeight = 0;
    tickCounter = 0;
    renderButton('harvesting', lastCommentCount);

    // Initial IndexedDB check
    extractFromIndexedDB().then(res => {
      if (res && res.success && res.count) {
        cachedIdbCount = res.count;
        if (isHarvesting) {
          renderButton('harvesting', Math.max(commentMap.size, cachedIdbCount));
        }
      }
    }).catch(() => {});

    // Run first step immediately, then interval
    stepHarvest();
    harvestInterval = setInterval(stepHarvest, 450);
  }

  function stopHarvestWithoutExport() {
    isHarvesting = false;
    if (harvestInterval) {
      clearInterval(harvestInterval);
      harvestInterval = null;
    }
    renderButton('idle');
  }

  function stopAndExport() {
    isHarvesting = false;
    if (harvestInterval) {
      clearInterval(harvestInterval);
      harvestInterval = null;
    }
    exportCSV();
  }

  // --- 17. Expose Global Instance for Zero-Reload Hot-Swap ---
  window.__teamsCommentsHarvester = {
    version: '1.3.0',
    destroy: () => {
      isHarvesting = false;
      if (harvestInterval) {
        clearInterval(harvestInterval);
        harvestInterval = null;
      }
      if (visibilityInterval) {
        clearInterval(visibilityInterval);
        visibilityInterval = null;
      }
      const el = document.getElementById(ROOT_ID);
      if (el) el.remove();
    },
    exportCSV: exportCSV,
    startHarvest: startHarvest,
    stopAndExport: stopAndExport,
    extractFromIndexedDB: extractFromIndexedDB,
    detectSessionFilename: detectSessionFilename,
    isTargetChannelView: isTargetChannelView
  };

  scanCurrentDOM();
  console.log('%c🛡️ Teams Lecture Comments Harvester v1.3.0 ready (Hybrid IndexedDB + DOM, Fluent Draggable UI).', 'color: #5b5fc7; font-weight: bold;');
})();
