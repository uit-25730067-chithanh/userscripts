const { chromium } = require('/Users/tcdtist/.nvm/versions/node/v22.12.0/lib/node_modules/@goonnguyen/human-cli/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const userScriptPath = path.resolve(__dirname, '../scripts/teams-courses-filter.user.js');
const mockHtmlPath = path.resolve(__dirname, 'mock-teams.html');
const userScriptCode = fs.readFileSync(userScriptPath, 'utf8');

async function run() {
  console.log('🚀 Khởi chạy Chromium Playwright (chế độ độc lập)...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(`file://${mockHtmlPath}`);

  // Inject userscript
  await page.evaluate((code) => {
    const script = document.createElement('script');
    script.textContent = code;
    document.body.appendChild(script);
  }, userScriptCode);

  await page.waitForTimeout(300);

  console.log('\n--- TEST CASE 1: Kiểm tra bỏ badge & kiểm tra margin switcher ---');
  const checkState = await page.evaluate(() => {
    const badgesCount = document.querySelectorAll('.citd-teams-semester-badge').length;
    const sw = document.getElementById('citd-teams-switcher');
    const rect = sw.getBoundingClientRect();
    const style = window.getComputedStyle(sw);
    return {
      badgesCount,
      marginLeft: style.marginLeft,
      marginRight: style.marginRight,
      leftPos: rect.left,
      width: rect.width
    };
  });

  console.log('Badge count:', checkState.badgesCount);
  console.log('Switcher position & margin:', checkState);

  if (checkState.badgesCount !== 0) {
    throw new Error(`❌ Không được có badge nào trong DOM! Thực tế tìm thấy: ${checkState.badgesCount}`);
  }
  console.log('✅ Đã loại bỏ hoàn toàn các badge học kỳ.');

  if (checkState.marginLeft === '0px' || checkState.leftPos <= 0) {
    throw new Error('❌ Switcher vẫn đang bị sát mép màn hình!');
  }
  console.log('✅ Switcher đã có khoảng cách đệm (margin) thoáng đãng, không còn dính sát viền.');

  console.log('\n--- TEST CASE 2: Kiểm tra lọc HK5 ---');
  const hk5Cards = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[role="group"][data-tid$="-team-card"]'));
    return cards
      .filter(c => {
        const item = c.closest('.fui-Flex');
        return item && item.style.display !== 'none' && c.closest('.fui-AccordionItem')?.style?.display !== 'none';
      })
      .map(c => c.querySelector('[data-testid="team-name"]')?.textContent.trim());
  });
  console.log('Danh sách 4 môn HK5:', hk5Cards);
  if (hk5Cards.length !== 4) {
    throw new Error(`❌ HK5 phải có 4 môn, thực tế có ${hk5Cards.length}`);
  }
  console.log('✅ 4 môn HK5 hiển thị chuẩn.');

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error' && msg.text().includes('CITD Teams Filter')) {
      consoleErrors.push(msg.text());
    }
  });

  console.log('\n--- TEST CASE 3: Chuyển sang HK4 (Kiểm tra hiển thị Classes (HK4), không xuất hiện chữ Hidden) ---');
  await page.click('button[data-semester="HK4"]');
  await page.waitForTimeout(350);

  const hk4State = await page.evaluate(() => {
    // Tìm tất cả các accordion item đang hiển thị
    const visibleHeaders = Array.from(document.querySelectorAll('.fui-AccordionItem'))
      .filter(item => window.getComputedStyle(item).display !== 'none')
      .map(item => {
        const title = item.querySelector('.fui-StyledText')?.textContent.trim();
        const desc = item.querySelector('[id$="-description"]')?.textContent.trim();
        return { title, desc };
      });

    const visibleCards = Array.from(document.querySelectorAll('[role="group"][data-tid$="-team-card"]'))
      .filter(c => {
        const item = c.closest('.fui-Flex');
        const accItem = c.closest('.fui-AccordionItem');
        return item && window.getComputedStyle(item).display !== 'none' &&
               accItem && window.getComputedStyle(accItem).display !== 'none';
      });

    const cardDetails = visibleCards.map(c => {
      const codePill = c.querySelector('.citd-card-code-pill')?.textContent.trim();
      const subject = c.querySelector('.citd-card-subject-title')?.textContent.trim();
      const teacher = c.querySelector('.citd-card-teacher-badge')?.textContent.trim();
      const avatar = c.querySelector('.fui-Avatar');
      const img = avatar?.querySelector('img');
      const codeSpan = avatar?.querySelector('.citd-avatar-subject-code');
      const avStyle = avatar ? window.getComputedStyle(avatar) : null;
      return {
        codePill,
        subject,
        teacher,
        imgDisplay: img ? window.getComputedStyle(img).display : null,
        avatarCode: codeSpan?.textContent.trim(),
        avatarWidth: avStyle?.width,
        avatarHeight: avStyle?.height,
        avatarBg: avStyle?.backgroundColor
      };
    });

    return {
      visibleHeaders,
      cardsCount: visibleCards.length,
      cardDetails
    };
  });

  console.log('Trạng thái HK4 Headers đang hiển thị:', hk4State.visibleHeaders);
  console.log('Số môn HK4 hiển thị:', hk4State.cardsCount);
  console.log('Chi tiết 5 môn HK4:', hk4State.cardDetails);

  // 1. Kiểm tra tiêu đề hiển thị: PHẢI là "Classes (HK4)" và TUYỆT ĐỐI KHÔNG CÓ chữ "Hidden"
  const hasHiddenHeader = hk4State.visibleHeaders.some(h => h.title.includes('Hidden'));
  if (hasHiddenHeader) {
    throw new Error(`❌ Ở tab HK4, TUYỆT ĐỐI KHÔNG ĐƯỢC có chữ 'Hidden'! Thực tế tìm thấy: ${JSON.stringify(hk4State.visibleHeaders)}`);
  }
  const hasClassesHk4 = hk4State.visibleHeaders.some(h => h.title === 'Classes (HK4)');
  if (!hasClassesHk4) {
    throw new Error(`❌ Ở tab HK4, tiêu đề phải là 'Classes (HK4)'! Thực tế: ${JSON.stringify(hk4State.visibleHeaders)}`);
  }
  console.log('✅ Không hề xuất hiện chữ "Hidden". Tiêu đề hiển thị duy nhất là "Classes (HK4)".');

  if (hk4State.cardsCount !== 5) {
    throw new Error(`❌ HK4 phải hiển thị đủ 5 môn, thực tế có: ${hk4State.cardsCount}`);
  }
  console.log('✅ Toàn bộ 5 môn HK4 đã hiển thị trọn vẹn.');

  // Kiểm tra Avatar mã môn của 5 môn HK4
  const expectedHk4 = ['CS112', 'CS106', 'CS114', 'SS007', 'IT005'];
  for (let i = 0; i < hk4State.cardDetails.length; i++) {
    const cd = hk4State.cardDetails[i];
    if (cd.imgDisplay !== 'none') {
      throw new Error(`❌ Thẻ img avatar của môn ${cd.codePill} phải bị ẩn (display: none)!`);
    }
    const expected = expectedHk4[i];
    if (cd.avatarCode !== expected) {
      throw new Error(`❌ Avatar môn thứ ${i+1} phải hiện mã môn ${expected}, nhưng nhận được: ${cd.avatarCode}`);
    }
    if (cd.avatarWidth !== '72px' || cd.avatarHeight !== '72px') {
      throw new Error(`❌ Avatar phải có kích thước 72x72: ${cd.avatarWidth}x${cd.avatarHeight}`);
    }
  }
  console.log('✅ Toàn bộ 5 môn HK4 hiển thị avatar mã môn (CS112, CS106, CS114, SS007, IT005) 72x72 chuẩn xác!');

  console.log('\n--- TEST CASE 4: Chuyển sang ALL (Kiểm tra khôi phục 100% layout & nhãn gốc Teams) ---');
  await page.click('button[data-semester="ALL"]');
  await page.waitForTimeout(350);

  const allState = await page.evaluate(() => {
    const classesTitle = document.querySelector('[data-tid="ClassTeamsSection-header"] .fui-StyledText')?.textContent.trim();
    const otherTitle = document.querySelector('[data-tid="OtherTeamsSection-header"] .fui-StyledText')?.textContent.trim();
    const hiddenTitle = document.querySelector('[data-tid="HiddenTeamsSection-header"] .fui-StyledText')?.textContent.trim();

    const hiddenHeader = document.querySelector('[data-tid="HiddenTeamsSection-header"]');
    const hiddenItem = hiddenHeader?.closest('.fui-AccordionItem');

    // Kiểm tra avatar của một card có img
    const firstHiddenCard = document.querySelector('[data-tid="HiddenTeamsSection-panel"] [role="group"][data-tid$="-team-card"]');
    const avatar = firstHiddenCard?.querySelector('.fui-Avatar');
    const img = avatar?.querySelector('img');

    // Kiểm tra xem còn bất kỳ custom element nào tồn tại trên các card không
    const customTitleBoxes = document.querySelectorAll('.citd-card-title-box').length;
    const customTeacherBadges = document.querySelectorAll('.citd-card-teacher-badge').length;
    const customAvatarCodes = document.querySelectorAll('.citd-avatar-subject-code').length;
    const customTodayCards = document.querySelectorAll('.citd-card-today').length;

    // Kiểm tra thẻ span gốc của Teams
    const origSpans = Array.from(document.querySelectorAll('[data-testid="team-name"] .fui-StyledText'))
      .filter(s => window.getComputedStyle(s).display !== 'none')
      .map(s => s.textContent.trim());

    return {
      classesTitle,
      otherTitle,
      hiddenTitle,
      hiddenItemDisplay: hiddenItem ? window.getComputedStyle(hiddenItem).display : null,
      imgDisplay: img ? window.getComputedStyle(img).display : null,
      customTitleBoxes,
      customTeacherBadges,
      customAvatarCodes,
      customTodayCards,
      origSpansCount: origSpans.length,
      sampleOrigText: origSpans[0]
    };
  });

  console.log('Trạng thái ở ALL:', allState);
  if (allState.classesTitle !== 'Classes' || allState.otherTitle !== 'Teams' || allState.hiddenTitle !== 'Hidden') {
    throw new Error('❌ Tab ALL phải khôi phục tiêu đề gốc (Classes, Teams, Hidden)!');
  }
  if (allState.hiddenItemDisplay === 'none') {
    throw new Error('❌ Tab ALL phải hiển thị lại mục Hidden!');
  }
  if (allState.imgDisplay === 'none') {
    throw new Error('❌ Thẻ img của avatar phải được khôi phục hiển thị ở tab ALL!');
  }
  if (allState.customTitleBoxes !== 0 || allState.customTeacherBadges !== 0 || allState.customAvatarCodes !== 0 || allState.customTodayCards !== 0) {
    throw new Error(`❌ Tab ALL không được áp dụng style sửa label hoặc viền neon! Còn sót lại: titleBoxes=${allState.customTitleBoxes}, teacherBadges=${allState.customTeacherBadges}, avatarCodes=${allState.customAvatarCodes}, todayCards=${allState.customTodayCards}`);
  }
  console.log('✅ Tab ALL khôi phục 100% về mặc định: 0 custom elements, cả 3 section hiển thị với tiêu đề gốc, avatar img hiển thị lại.');

  console.log('\n--- TEST CASE 5: Chuyển lại HK5 để kiểm tra định dạng card & Font-weight ---');
  await page.click('button[data-semester="HK5"]');
  await page.waitForTimeout(350);

  console.log('\n--- TEST CASE 6: Kiểm tra Tên môn KHÔNG BOLD (font-weight: 400) & Tên GV dài không bị cắt ---');
  const cardDetailsCheck = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[role="group"][data-tid$="-team-card"]'))
      .filter(c => {
        const item = c.closest('.fui-Flex');
        return item && item.style.display !== 'none';
      });

    return cards.map(c => {
      const subjectEl = c.querySelector('.citd-card-subject-title');
      const teacherEl = c.querySelector('.citd-card-teacher-badge');
      const subjectStyle = subjectEl ? window.getComputedStyle(subjectEl) : null;
      const teacherStyle = teacherEl ? window.getComputedStyle(teacherEl) : null;
      return {
        subject: subjectEl?.textContent.trim(),
        subjectFontWeight: subjectStyle?.fontWeight,
        teacher: teacherEl?.textContent.trim(),
        teacherMaxWidth: teacherStyle?.maxWidth,
        teacherScrollWidth: teacherEl?.scrollWidth,
        teacherClientWidth: teacherEl?.clientWidth
      };
    });
  });

  console.log('Chi tiết kiểm tra font-weight & độ rộng giảng viên:', cardDetailsCheck);

  // Kiểm tra font-weight của tiêu đề môn học: PHẢI LÀ '400' (normal, KHÔNG ĐƯỢC BOLD)
  for (const c of cardDetailsCheck) {
    if (c.subjectFontWeight !== '400') {
      throw new Error(`❌ Tên môn học '${c.subject}' bị in đậm! font-weight: ${c.subjectFontWeight} (yêu cầu bắt buộc 400)!`);
    }
  }
  console.log('✅ Toàn bộ tên môn học hiển thị font-weight 400 (normal, tuyệt đối không in đậm)!');

  // Kiểm tra SS008 với giảng viên dài "ThS. Trần Thị Hoài Thương"
  const ss008 = cardDetailsCheck.find(c => c.subject.includes('Kinh tế chính trị'));
  if (!ss008) throw new Error('❌ Không tìm thấy thẻ môn SS008!');
  if (ss008.teacher !== 'ThS. Trần Thị Hoài Thương') {
    throw new Error(`❌ Tên giảng viên SS008 không khớp! Nhận được: ${ss008.teacher}`);
  }
  // Đảm bảo không bị cắt bởi max-width cứng (scrollWidth xấp xỉ clientWidth)
  if (ss008.teacherScrollWidth > ss008.teacherClientWidth + 1) {
    throw new Error(`❌ Tên giảng viên '${ss008.teacher}' vẫn bị cắt mất chữ! scrollWidth: ${ss008.teacherScrollWidth}, clientWidth: ${ss008.teacherClientWidth}`);
  }
  console.log('✅ Tên giảng viên nhiều chữ (ThS. Trần Thị Hoài Thương) hiển thị trọn vẹn, không bị cắt.');

  // Kiểm tra vị trí hiển thị giảng viên: Nằm ở Footer bên phải; Tự động ẩn khi có nút Join now
  const locationCheck = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[role="group"][data-tid$="-team-card"]'))
      .filter(c => {
        const item = c.closest('.fui-Flex');
        return item && item.style.display !== 'none';
      });

    return cards.map(c => {
      const titleBox = c.querySelector('.citd-card-title-box');
      const footer = c.querySelector('.fui-CardFooter');
      const teacherInTitleBox = titleBox ? titleBox.querySelector('.citd-card-teacher-badge') !== null : false;
      const teacherEl = footer ? footer.querySelector('.citd-card-teacher-badge') : null;
      const teacherVisible = teacherEl ? window.getComputedStyle(teacherEl).display !== 'none' : false;
      const joinBtn = footer ? footer.querySelector('[data-testid="join-button"]') : null;
      const joinBtnVisible = joinBtn ? window.getComputedStyle(joinBtn).display !== 'none' : false;
      const footerAlignItems = footer ? window.getComputedStyle(footer).alignItems : null;
      return {
        code: c.querySelector('.citd-card-code-pill')?.textContent.trim(),
        teacherInTitleBox,
        hasTeacherInFooter: teacherEl !== null,
        teacherVisible,
        hasJoinBtn: joinBtn !== null,
        joinBtnVisible,
        footerAlignItems
      };
    });
  });

  for (const item of locationCheck) {
    if (item.teacherInTitleBox) {
      throw new Error(`❌ Thẻ ${item.code} vẫn còn badge giảng viên trong Title Box! Yêu cầu Title Box chỉ chứa Mã môn & Tên môn.`);
    }
    if (!item.hasTeacherInFooter) {
      throw new Error(`❌ Thẻ ${item.code} không tìm thấy badge giảng viên trong Footer!`);
    }
    if (item.footerAlignItems !== 'center') {
      throw new Error(`❌ Thẻ ${item.code} có Footer không phải align-items: center (hiện tại: ${item.footerAlignItems})!`);
    }
  }

  // Thẻ SE104 có nút Join now: Badge giảng viên phải được tự động ẩn để nhường chỗ
  const se104Card = locationCheck.find(item => item.code?.startsWith('SE104'));
  if (!se104Card || !se104Card.joinBtnVisible) {
    throw new Error('❌ Nút Join now của SE104 không hiển thị trong Footer!');
  }
  if (se104Card.teacherVisible) {
    throw new Error('❌ Thẻ SE104 đang có nút Join now nhưng badge giảng viên vẫn hiển thị (chưa tự động ẩn)!');
  }

  // Các thẻ khác không có nút Join now: Badge giảng viên phải hiển thị bình thường ở Footer
  const normalCards = locationCheck.filter(item => !item.code?.startsWith('SE104'));
  for (const card of normalCards) {
    if (!card.teacherVisible) {
      throw new Error(`❌ Thẻ ${card.code} không có cuộc họp nhưng badge giảng viên lại bị ẩn!`);
    }
  }
  console.log('✅ Title Box vuông vức, Footer cân đối: Thẻ thường hiển thị Giảng viên bên phải; Thẻ có lớp học tự động ẩn Giảng viên nhường chỗ 100% cho nút Join now!');

  // Kiểm tra hiệu ứng viền Neon (citd-card-today) cho môn có lịch học trong ngày hôm nay
  const neonCheck = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[role="group"][data-tid$="-team-card"]'))
      .filter(c => {
        const item = c.closest('.fui-Flex');
        return item && item.style.display !== 'none';
      });
    return cards.map(c => {
      const code = c.querySelector('.citd-card-code-pill')?.textContent.trim();
      const isToday = c.classList.contains('citd-card-today');
      const style = window.getComputedStyle(c);
      return {
        code,
        isToday,
        boxShadow: style.boxShadow,
        borderColor: style.borderColor
      };
    });
  });

  const todayCard = neonCheck.find(c => c.isToday);
  if (!todayCard) {
    throw new Error('❌ Không tìm thấy thẻ môn học nào có viền neon (citd-card-today) cho ngày hôm nay!');
  }
  if (!todayCard.boxShadow || todayCard.boxShadow === 'none') {
    throw new Error(`❌ Thẻ ${todayCard.code} không có hiệu ứng phát sáng neon (box-shadow: ${todayCard.boxShadow})!`);
  }
  console.log(`✅ Đã kích hoạt viền Neon nổi bật cho môn có lịch hôm nay: ${todayCard.code} (boxShadow: ${todayCard.boxShadow.slice(0, 45)}...)`);
  await page.screenshot({ path: path.join(__dirname, '../tmp/screenshot_neon_today.png') });
  console.log('📸 Đã lưu screenshot viền Neon: tmp/screenshot_neon_today.png');

  console.log('\n--- TEST CASE 7: Kiểm tra ổn định khi chuyển tab & bật/tắt Other teams liên tục ---');
  // Thực hiện chuỗi click chuyển tab nhanh để kiểm tra độ ổn định
  const sequence = ['HK2', 'HK5', 'HK4', 'ALL', 'HK5', 'HK2', 'HK5'];
  for (const sem of sequence) {
    await page.click(`button[data-semester="${sem}"]`);
    await page.waitForTimeout(100);
  }
  // Toggle Other teams nhiều lần
  await page.click('#citd-teams-toggle-other'); // Show
  await page.waitForTimeout(100);
  await page.click('#citd-teams-toggle-other'); // Hide
  await page.waitForTimeout(100);
  await page.click('#citd-teams-toggle-other'); // Show
  await page.waitForTimeout(250);

  const finalCheck = await page.evaluate(() => {
    // Kiểm tra xem có bị duplicate Classes section không
    const classesHeaders = Array.from(document.querySelectorAll('.fui-AccordionHeader .fui-StyledText'))
      .map(el => el.textContent.trim())
      .filter(t => t.startsWith('Classes'));

    const otherTeamsHeader = Array.from(document.querySelectorAll('.fui-AccordionHeader .fui-StyledText'))
      .map(el => el.textContent.trim())
      .find(t => t === 'Other teams');

    const visibleHk5Cards = Array.from(document.querySelectorAll('[data-tid="ClassTeamsSection-panel"] [role="group"]'))
      .filter(c => c.closest('.fui-Flex')?.style.display !== 'none');

    const visibleOtherCards = Array.from(document.querySelectorAll('[data-tid="OtherTeamsSection-panel"] [role="group"]'))
      .filter(c => c.closest('.fui-Flex')?.style.display !== 'none');

    return {
      classesHeaders,
      hasOtherTeams: !!otherTeamsHeader,
      hk5Count: visibleHk5Cards.length,
      otherCount: visibleOtherCards.length
    };
  });

  console.log('Trạng thái sau khi click qua lại nhiều lần:', finalCheck);

  if (finalCheck.classesHeaders.length !== 1) {
    throw new Error(`❌ Bị lỗi trùng lặp tiêu đề Classes! Tìm thấy ${finalCheck.classesHeaders.length}: ${JSON.stringify(finalCheck.classesHeaders)}`);
  }
  if (finalCheck.hk5Count !== 4) {
    throw new Error(`❌ HK5 phải có đúng 4 môn, thực tế có ${finalCheck.hk5Count}`);
  }
  if (!finalCheck.hasOtherTeams || finalCheck.otherCount !== 1) {
    throw new Error(`❌ Other teams khi Show phải hiển thị 1 team, thực tế có ${finalCheck.otherCount}`);
  }
  console.log('✅ Chuyển tab và ẩn hiện Other teams hoàn toàn ổn định, không xuất hiện trùng lặp tiêu đề Classes hay lỗi giao diện!');

  console.log('\n--- TEST CASE 8: Kiểm tra thu nhỏ (Collapse) & mở rộng (Expand) Accordion ---');
  // 1. Click thu nhỏ
  await page.click('[data-tid="ClassTeamsSection-header"] button');
  await page.waitForTimeout(300);

  const collapsedState = await page.evaluate(() => {
    const header = document.querySelector('[data-tid="ClassTeamsSection-header"]');
    const item = header?.closest('.fui-AccordionItem');
    const btn = header?.querySelector('button');
    const title = header?.querySelector('.fui-StyledText')?.textContent.trim();
    const desc = header?.querySelector('#ClassTeamsSection-description')?.textContent.trim();
    const panel = document.querySelector('[data-tid="ClassTeamsSection-panel"]');
    return {
      itemDisplay: item ? window.getComputedStyle(item).display : null,
      panelDisplay: panel ? window.getComputedStyle(panel).display : null,
      ariaExpanded: btn?.getAttribute('aria-expanded'),
      title,
      desc
    };
  });

  console.log('Trạng thái sau khi click thu nhỏ:', collapsedState);
  if (collapsedState.itemDisplay === 'none') {
    throw new Error('❌ Lỗi: Accordion Item (Header) bị biến mất khi click thu nhỏ!');
  }
  if (collapsedState.panelDisplay !== 'none') {
    throw new Error(`❌ Panel phải ẩn (display: none) khi thu nhỏ! Thực tế: ${collapsedState.panelDisplay}`);
  }
  if (collapsedState.ariaExpanded !== 'false') {
    throw new Error(`❌ Nút phải có aria-expanded="false" khi thu nhỏ! Thực tế: ${collapsedState.ariaExpanded}`);
  }
  if (!collapsedState.title.includes('Classes (HK5)')) {
    throw new Error(`❌ Tiêu đề sai sau khi thu nhỏ: ${collapsedState.title}`);
  }
  if (collapsedState.desc !== '4 teams') {
    throw new Error(`❌ Mô tả sai sau khi thu nhỏ: ${collapsedState.desc}`);
  }
  console.log('✅ Khi thu nhỏ: Header vẫn hiển thị đầy đủ, tiêu đề và số lượng bảo toàn, panel thu nhỏ chính xác.');

  // 2. Click mở rộng lại
  await page.click('[data-tid="ClassTeamsSection-header"] button');
  await page.waitForTimeout(300);

  const expandedState = await page.evaluate(() => {
    const header = document.querySelector('[data-tid="ClassTeamsSection-header"]');
    const item = header?.closest('.fui-AccordionItem');
    const btn = header?.querySelector('button');
    const panel = document.querySelector('[data-tid="ClassTeamsSection-panel"]');
    const visibleCards = Array.from(document.querySelectorAll('[data-tid="ClassTeamsSection-panel"] [role="group"]'))
      .filter(c => c.closest('.fui-Flex')?.style.display !== 'none');
    return {
      itemDisplay: item ? window.getComputedStyle(item).display : null,
      panelDisplay: panel ? window.getComputedStyle(panel).display : null,
      ariaExpanded: btn?.getAttribute('aria-expanded'),
      cardsCount: visibleCards.length,
      cards: visibleCards.map(c => c.querySelector('.citd-card-code-pill')?.textContent.trim())
    };
  });

  console.log('Trạng thái sau khi click mở rộng lại:', expandedState);
  if (expandedState.itemDisplay === 'none' || expandedState.panelDisplay === 'none') {
    throw new Error('❌ Panel hoặc Header bị ẩn sau khi mở rộng!');
  }
  if (expandedState.ariaExpanded !== 'true') {
    throw new Error(`❌ Nút phải có aria-expanded="true" khi mở rộng! Thực tế: ${expandedState.ariaExpanded}`);
  }
  if (expandedState.cardsCount !== 4) {
    throw new Error(`❌ Phải hiển thị lại đủ 4 môn HK5, thực tế: ${expandedState.cardsCount}`);
  }
  console.log('✅ Khi mở rộng lại: 4 môn HK5 hiển thị đầy đủ!');

  console.log('\n--- TEST CASE 9: Kiểm tra thanh điều hướng Apps (Chỉ hoạt động ở app Teams) ---');
  // 1. Chuyển sang app Chat
  console.log('👉 Click chuyển sang app Chat...');
  await page.click('#app-btn-chat');
  await page.waitForTimeout(300);

  const chatState = await page.evaluate(() => {
    const sw = document.getElementById('citd-teams-switcher');
    const chatBtn = document.getElementById('app-btn-chat');
    const teamsBtn = document.getElementById('app-btn-teams');
    return {
      switcherDisplay: sw ? window.getComputedStyle(sw).display : null,
      chatPressed: chatBtn?.getAttribute('aria-pressed'),
      teamsPressed: teamsBtn?.getAttribute('aria-pressed')
    };
  });

  console.log('Trạng thái khi ở app Chat:', chatState);
  if (chatState.switcherDisplay !== 'none') {
    throw new Error(`❌ Khi ở app Chat, thanh switcher BẮT BUỘC phải ẩn (display: none)! Thực tế: ${chatState.switcherDisplay}`);
  }
  console.log('✅ Khi ở app Chat: Bộ lọc tự động ẩn hoàn toàn (display: none), không can thiệp vào giao diện Chat.');

  // 2. Chuyển sang app Calendar
  console.log('👉 Click chuyển sang app Calendar...');
  await page.click('#app-btn-calendar');
  await page.waitForTimeout(300);

  const calendarState = await page.evaluate(() => {
    const sw = document.getElementById('citd-teams-switcher');
    return {
      switcherDisplay: sw ? window.getComputedStyle(sw).display : null
    };
  });
  console.log('Trạng thái khi ở app Calendar:', calendarState);
  if (calendarState.switcherDisplay !== 'none') {
    throw new Error(`❌ Khi ở app Calendar, thanh switcher phải bị ẩn! Thực tế: ${calendarState.switcherDisplay}`);
  }
  console.log('✅ Khi ở app Calendar: Bộ lọc vẫn ẩn hoàn toàn.');

  // 3. Chuyển lại app Teams
  console.log('👉 Click quay lại app Teams...');
  await page.click('#app-btn-teams');
  await page.waitForTimeout(350);

  const backTeamsState = await page.evaluate(() => {
    const sw = document.getElementById('citd-teams-switcher');
    const teamsBtn = document.getElementById('app-btn-teams');
    const visibleCards = Array.from(document.querySelectorAll('[data-tid="ClassTeamsSection-panel"] [role="group"]'))
      .filter(c => c.closest('.fui-Flex')?.style.display !== 'none');
    return {
      switcherDisplay: sw ? window.getComputedStyle(sw).display : null,
      teamsPressed: teamsBtn?.getAttribute('aria-pressed'),
      hk5Count: visibleCards.length
    };
  });

  console.log('Trạng thái khi quay lại app Teams:', backTeamsState);
  if (backTeamsState.switcherDisplay === 'none') {
    throw new Error('❌ Khi quay lại app Teams, thanh switcher phải hiển thị lại bình thường!');
  }
  if (backTeamsState.hk5Count !== 4) {
    throw new Error(`❌ Danh sách môn HK5 phải hiển thị lại đủ 4 môn, thực tế có: ${backTeamsState.hk5Count}`);
  }
  console.log('✅ Khi quay lại app Teams: Thanh switcher lập tức xuất hiện trở lại, 4 môn HK5 hiển thị chuẩn xác!');

  await page.screenshot({ path: path.resolve(__dirname, '../tmp/screenshot_v4_app_switching_passed.png') });
  console.log('📸 Đã lưu screenshot: tmp/screenshot_v4_app_switching_passed.png');

  console.log('\n--- KIỂM TRA CONSOLE ERRORS ---');
  if (consoleErrors.length > 0) {
    throw new Error(`❌ Phát hiện ${consoleErrors.length} lỗi trong console từ userscript:\n${consoleErrors.join('\n')}`);
  }
  console.log('✅ Console hoàn toàn sạch bóng, 0 lỗi từ userscript!');

  console.log('\n🎉 TẤT CẢ 9 TEST CASES ĐỀU PASS 100%!');
  await browser.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
