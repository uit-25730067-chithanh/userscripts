// ==UserScript==
// @name         Hide & Sort Courses - Microsoft Teams (UIT CITD)
// @namespace    Violentmonkey Scripts
// @version      1.0
// @description  Lọc và sắp xếp môn học Microsoft Teams theo học kỳ HK1 - HK5 và ALL, theo thứ tự thời khóa biểu (Tối ưu cho Teams Web)
// @author       Dang Chi Thanh
// @match        https://teams.cloud.microsoft/*
// @match        https://teams.microsoft.com/*
// @icon         https://statics.teams.cdn.office.net/evergreen-assets/icons/favicon.ico
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // =========================================================================
    // 1. DANH MỤC MÔN HỌC THEO TỪNG HỌC KỲ (Đúng thứ tự kênh Discord [29] -> [01])
    //    Thứ 7, Chủ Nhật ở trên cùng -> Thứ 2 ở dưới cùng
    // =========================================================================
    const SEMESTER_COURSES = {
        HK5: [
            { code: 'CS311.G11.CN2.TTNT', alt: 'CS311' }, // [29] Kỹ thuật lập trình Trí tuệ nhân tạo (Chủ nhật)
            { code: 'SS009.G11.CN1.CNTT', alt: 'SS009' }, // [28] Chủ nghĩa xã hội khoa học (Thứ 7)
            { code: 'CS315.G12.LT.TTNT', alt: 'CS315' },  // [27] Máy học nâng cao (Thứ 6)
            { code: 'SS008.G11.CN1.CNTT', alt: 'SS008' }, // [26] Kinh tế chính trị Mác – Lênin (Thứ 5)
            { code: 'CE340.G12.LT.TTNT', alt: 'CE340' },  // [25] Trí tuệ nhân tạo cho hệ thống nhúng (Thứ 4)
            { code: 'SE104.G11.CN2.TTNT', alt: 'SE104' }  // [24] Nhập môn công nghệ phần mềm (Thứ 3)
        ],
        HK4: [
            { code: 'CS112.F31.LT.TTNT', alt: 'CS112' },  // [23] Phân tích và thiết kế thuật toán (Thứ 7)
            { code: 'CS106.F31.CN2.TTNT', alt: 'CS106' }, // [22] Trí tuệ nhân tạo (Thứ 6)
            { code: 'CS114.F31.CN2.TTNT', alt: 'CS114' }, // [21] Máy học (Thứ 5)
            { code: 'SS007.F31.CN1.CNTT', alt: 'SS007' }, // [20] Triết học Mác – Lênin (Thứ 4)
            { code: 'IT005.F32.CN1.TTNT', alt: 'IT005' }  // [19] Nhập môn mạng máy tính (Thứ 3)
        ],
        HK3: [
            { code: 'IT004.F23.CN2.TTNT', alt: 'IT004' }, // [18] Cơ sở dữ liệu (Chủ nhật)
            { code: 'IT007.F23.CN1.TTNT', alt: 'IT007' }, // [17] Hệ điều hành (Thứ 7)
            { code: 'AI002.F21.CN1.TTNT', alt: 'AI002' }, // [16] Tư duy Trí tuệ nhân tạo (Thứ 5)
            { code: 'ENG03.F22.CN1.TTNT', alt: 'ENG03' }, // [15] Anh văn 3 (Thứ 4)
            { code: 'CS115.F21.CN1.TTNT', alt: 'CS115' }  // [14] Toán cho Khoa học máy tính (Thứ 2)
        ],
        HK2: [
            { code: 'ENG02.F11.CN1.CNTT', alt: 'ENG02' }, // [13] Anh văn 02 (Chủ nhật / Thứ 7)
            { code: 'IT002.F13.CN2.TTNT', alt: 'IT002' }, // [12] Lập trình hướng đối tượng (Thứ 6)
            { code: 'IT012.F31.CN1.TTNT', alt: 'IT012' }, // [11] Tổ chức và cấu trúc máy tính II (Thứ 5)
            { code: 'MA005.F31.CN1.TTNT', alt: 'MA005' }, // [10] Xác suất thống kê (Thứ 4)
            { code: 'MA004.F11.CN1.CNTT', alt: 'MA004' }, // [09] Cấu trúc rời rạc (Thứ 3)
            { code: 'IT003.F14.CN2.TTNT', alt: 'IT003' }  // [08] Cấu trúc dữ liệu và giải thuật (Thứ 2)
        ],
        HK1: [
            { code: 'SS006.E31.CN1.CNTT', alt: 'SS006' }, // [07] Pháp luật đại cương (Chủ nhật)
            { code: 'MA006.E31.CN1.CNTT', alt: 'MA006' }, // [06] Giải tích (Thứ 7)
            { code: 'MA003.E31.CN1.CNTT', alt: 'MA003' }, // [05] Đại số tuyến tính (Thứ 6)
            { code: 'ENG01.E31.CN1.CNTT', alt: 'ENG01' }, // [04] Anh văn 01 (Thứ 5)
            { code: 'IT001.E33.CN2.TTNT', alt: 'IT001' }, // [03] Nhập môn Lập trình (Thứ 4)
            { code: 'SS004.E31.CN1.CNTT', alt: 'SS004' }, // [02] Kỹ năng nghề nghiệp (Thứ 3)
            { code: 'AI001.E31.CN2.TTNT', alt: 'AI001' }  // [01] Giới thiệu ngành Trí tuệ nhân tạo (Thứ 2)
        ]
    };

    const SEMESTER_WEIGHT = {
        HK5: 100,
        HK4: 200,
        HK3: 300,
        HK2: 400,
        HK1: 500
    };

    const VALID_SEMESTERS = ['HK5', 'HK4', 'HK3', 'HK2', 'HK1', 'ALL'];
    let currentSemester = localStorage.getItem('citd_teams_active_semester') || 'HK5';
    if (!VALID_SEMESTERS.includes(currentSemester)) {
        currentSemester = 'HK5';
    }

    // Trạng thái hiển thị nhóm khác (Mặc định: false = Ẩn nhóm ngoài lề)
    let showOtherTeams = localStorage.getItem('citd_teams_show_other') === 'true';

    // =========================================================================
    // 2. COURSE MATCHER & HELPER
    // =========================================================================
    function matchCourse(text, item) {
        if (!text) return false;
        if (text.includes(item.code)) return true;
        if (item.alt) {
            const regex = new RegExp(`(^|[^a-zA-Z0-9])${item.alt}([^a-zA-Z0-9]|$)`, 'i');
            if (regex.test(text)) return true;
        }
        return false;
    }

    function findCourseInfo(text) {
        if (!text) return null;
        for (const [semKey, courses] of Object.entries(SEMESTER_COURSES)) {
            for (let i = 0; i < courses.length; i++) {
                if (matchCourse(text, courses[i])) {
                    return {
                        semester: semKey,
                        index: i,
                        item: courses[i]
                    };
                }
            }
        }
        return null;
    }

    // =========================================================================
    // 2.1 PHÂN TÁCH TÊN LỚP THÀNH 3 PHẦN: MÃ LỚP - TÊN MÔN - GIẢNG VIÊN
    // =========================================================================
    function parseCourseTitle(raw) {
        if (!raw) return null;
        // Tách theo dấu gạch ngang có khoảng trắng: " - ", " – ", " — "
        const parts = raw.split(/\s+[-–—]\s+/).map(p => p.trim());
        if (parts.length >= 3) {
            return {
                code: parts[0],
                subject: parts.slice(1, -1).join(' - '),
                teacher: parts[parts.length - 1]
            };
        } else if (parts.length === 2) {
            return {
                code: parts[0],
                subject: parts[1],
                teacher: ''
            };
        }
        return null;
    }

    const DEPT_COLORS = {
        CS: '#007878', // Khoa học máy tính - Teal
        SE: '#8e44ad', // Kỹ thuật phần mềm - Purple
        IT: '#5c2d91', // Công nghệ thông tin - Violet
        CE: '#d13438', // Kỹ thuật máy tính - Red
        MA: '#0063b1', // Toán học - Cobalt Blue
        SS: '#107c41', // Lý luận chính trị / Kỹ năng - Emerald Green
        AI: '#004e8c', // Trí tuệ nhân tạo - Navy Blue
        ENG: '#b146c2' // Ngoại ngữ - Magenta
    };

    function getDeptColor(subjectCode) {
        if (!subjectCode) return '#007878';
        const prefix = subjectCode.replace(/[0-9].*$/, '').toUpperCase();
        return DEPT_COLORS[prefix] || '#007878';
    }

    function updateCardAvatar(card, subjectCode) {
        if (!subjectCode) return;
        const avatar = card.querySelector('.fui-Avatar');
        if (!avatar) return;

        // Lưu lại màu nền gốc nếu có
        if (avatar.dataset.citdOriginalBg === undefined) {
            avatar.dataset.citdOriginalBg = avatar.style.backgroundColor || '';
        }

        // Teams thật dùng API profilepicturev2 trả về thẻ <img> chứa 2 chữ cái ngẫu nhiên.
        // Cần ẩn <img> này để hiển thị mã môn chuẩn của UIT.
        const img = avatar.querySelector('img');
        if (img) {
            img.style.display = 'none';
        }

        // Ẩn chữ viết tắt cũ nếu có
        const initialsEl = avatar.querySelector('.fui-Avatar__initials');
        if (initialsEl) {
            initialsEl.style.display = 'none';
        }

        let codeEl = avatar.querySelector('.citd-avatar-subject-code');
        if (!codeEl) {
            codeEl = document.createElement('span');
            codeEl.className = 'citd-avatar-subject-code';
            avatar.appendChild(codeEl);
        }

        if (codeEl.textContent !== subjectCode) {
            codeEl.textContent = subjectCode;
        }
        codeEl.style.display = 'flex';

        // Gán màu nền theo khoa chuẩn Fluent UI
        const deptBg = getDeptColor(subjectCode);
        avatar.style.backgroundColor = deptBg;
    }

    function restoreCardAvatar(card) {
        const avatar = card.querySelector('.fui-Avatar');
        if (!avatar) return;

        const img = avatar.querySelector('img');
        if (img) {
            img.style.display = '';
        }

        const initialsEl = avatar.querySelector('.fui-Avatar__initials');
        if (initialsEl) {
            initialsEl.style.display = '';
        }

        const codeEl = avatar.querySelector('.citd-avatar-subject-code');
        if (codeEl) {
            codeEl.remove();
        }

        if (avatar.dataset.citdOriginalBg !== undefined) {
            avatar.style.backgroundColor = avatar.dataset.citdOriginalBg;
            delete avatar.dataset.citdOriginalBg;
        }
    }

    function getCardColumnItem(card) {
        if (!card) return null;
        let el = card;
        while (el && el.parentElement) {
            const parent = el.parentElement;
            if (parent.getAttribute('data-tid')?.includes('TeamsSection-panel') ||
                parent.classList.contains('fui-AccordionPanel') ||
                parent.matches?.('[class*="5robsm0"]') ||
                (parent.querySelectorAll?.('[role="group"][data-tid$="-team-card"]').length > 1)) {
                return el;
            }
            el = parent;
        }
        return card;
    }

    function getCardSectionId(card) {
        const panel = card.closest('[data-tid$="TeamsSection-panel"]');
        if (panel) {
            const tid = panel.getAttribute('data-tid') || '';
            if (tid.includes('ClassTeamsSection')) return 'ClassTeamsSection';
            if (tid.includes('OtherTeamsSection')) return 'OtherTeamsSection';
            if (tid.includes('HiddenTeamsSection')) return 'HiddenTeamsSection';
        }
        const cardTid = card.getAttribute('data-tid') || '';
        if (cardTid.includes('ClassTeamsSection')) return 'ClassTeamsSection';
        if (cardTid.includes('OtherTeamsSection')) return 'OtherTeamsSection';
        if (cardTid.includes('HiddenTeamsSection')) return 'HiddenTeamsSection';
        return 'ClassTeamsSection';
    }

    function formatCourseCard(card, titleText) {
        const titleInfo = parseCourseTitle(titleText);
        if (!titleInfo || !titleInfo.code) return;

        // Cập nhật Avatar: Hiển thị mã môn học trên 1 dòng duy nhất
        const subjectCode = titleInfo.code.split('.')[0];
        if (subjectCode) {
            updateCardAvatar(card, subjectCode);
        }

        const nameBtn = card.querySelector('[data-testid="team-name"]');
        if (!nameBtn) return;

        // Lưu giữ nguyên văn bản gốc trong aria-label để matcher và tìm kiếm hoạt động
        if (!nameBtn.getAttribute('aria-label')) {
            nameBtn.setAttribute('aria-label', titleText);
        }

        // Tìm span chữ gốc do React render (KHÔNG GỌI removeChild ĐỂ TRÁNH CRASH REACT FIBER!)
        const origTextSpan = nameBtn.querySelector('.fui-StyledText:not(.citd-card-title-box)');
        let isUnread = false;
        if (origTextSpan) {
            // Kiểm tra trạng thái unread nhanh, không gọi getComputedStyle để tránh Layout Thrashing
            if (origTextSpan.classList.contains('fui-StyledText--bold') ||
                origTextSpan.style.fontWeight === '600' ||
                origTextSpan.style.fontWeight === 'bold' ||
                card.classList.contains('fui-Card--unread') ||
                card.getAttribute('data-unread') === 'true') {
                isUnread = true;
            }
            origTextSpan.style.display = 'none';
        }

        // Tạo hoặc tái sử dụng container tùy biến do Userscript kiểm soát
        let titleBox = nameBtn.querySelector('.citd-card-title-box');
        if (!titleBox) {
            titleBox = document.createElement('span');
            titleBox.className = 'citd-card-title-box fui-StyledText';
            nameBtn.appendChild(titleBox);
        }

        if (titleBox.dataset.citdCode !== titleInfo.code) {
            titleBox.dataset.citdCode = titleInfo.code;
            while (titleBox.firstChild) {
                titleBox.removeChild(titleBox.firstChild);
            }

            const codePill = document.createElement('span');
            codePill.className = 'citd-card-code-pill';
            codePill.textContent = titleInfo.code;
            codePill.title = `Mã lớp: ${titleInfo.code}`;
            titleBox.appendChild(codePill);

            const subjectEl = document.createElement('span');
            subjectEl.className = 'citd-card-subject-title' + (isUnread ? ' citd-unread' : '');
            subjectEl.textContent = titleInfo.subject;
            subjectEl.title = titleInfo.subject;
            titleBox.appendChild(subjectEl);
        } else {
            const subjectEl = titleBox.querySelector('.citd-card-subject-title');
            if (subjectEl) {
                if (isUnread) subjectEl.classList.add('citd-unread');
                else subjectEl.classList.remove('citd-unread');
            }
        }
        titleBox.style.display = 'flex';

        // 2. Định dạng Giảng viên: Thêm badge vào footer (tự dạt sang phải qua margin-left: auto)
        if (titleInfo.teacher) {
            const footer = card.querySelector('.fui-CardFooter');
            if (footer) {
                let teacherBadge = footer.querySelector('.citd-card-teacher-badge');
                if (!teacherBadge) {
                    teacherBadge = document.createElement('span');
                    teacherBadge.className = 'citd-card-teacher-badge';
                    footer.appendChild(teacherBadge);
                }
                if (teacherBadge.textContent !== titleInfo.teacher) {
                    teacherBadge.textContent = titleInfo.teacher;
                    teacherBadge.title = `Giảng viên: ${titleInfo.teacher}`;
                }
                teacherBadge.style.display = 'inline-flex';
            }
        }
    }

    function restoreCourseCard(card) {
        restoreCardAvatar(card);

        const nameBtn = card.querySelector('[data-testid="team-name"]');
        if (nameBtn) {
            const origTextSpan = nameBtn.querySelector('.fui-StyledText:not(.citd-card-title-box)');
            if (origTextSpan) {
                origTextSpan.style.display = '';
            }
            const titleBox = nameBtn.querySelector('.citd-card-title-box');
            if (titleBox) {
                titleBox.remove();
            }
        }

        const teacherBadge = card.querySelector('.citd-card-teacher-badge');
        if (teacherBadge) {
            teacherBadge.remove();
        }
    }

    // =========================================================================
    // 3. INJECT STYLES (Chuẩn Fluent UI v9 - Hỗ trợ cả Dark & Light Mode)
    // =========================================================================
    function injectStyles() {
        if (document.getElementById('citd-teams-custom-styles')) return;

        const style = document.createElement('style');
        style.id = 'citd-teams-custom-styles';
        style.appendChild(document.createTextNode(`
            /* Đảm bảo bố cục khung lưới luôn xếp dọc và chiếm 100% chiều ngang */
            [data-tid="teams-grid-view"] {
                display: flex !important;
                flex-direction: column !important;
                width: 100% !important;
                max-width: 100% !important;
                box-sizing: border-box !important;
            }
            [data-tid="teams-grid-view"] > .fui-Accordion {
                width: 100% !important;
                max-width: 100% !important;
                box-sizing: border-box !important;
            }

            /* Thanh Switcher chuẩn Fluent UI nằm ngang phía trên */
            .citd-teams-switcher-bar {
                display: flex;
                align-items: center !important;
                justify-content: space-between !important;
                flex-direction: row !important;
                flex-wrap: wrap !important;
                gap: 12px !important;
                width: calc(100% - 40px) !important;
                max-width: calc(100% - 40px) !important;
                margin: 12px 20px 16px 20px !important;
                padding: 10px 18px !important;
                box-sizing: border-box !important;
                flex: 0 0 auto !important;
                background: var(--colorNeutralBackground1, #ffffff) !important;
                color: var(--colorNeutralForeground1, #242424) !important;
                border: 1px solid var(--colorNeutralStroke2, rgba(0, 0, 0, 0.08)) !important;
                border-radius: 8px !important;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04) !important;
                font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif !important;
                min-height: 48px !important;
                z-index: 5 !important;
            }
            .citd-teams-switcher-left {
                display: inline-flex !important;
                align-items: center !important;
                gap: 12px !important;
                flex-wrap: wrap !important;
            }
            .citd-teams-switcher-right {
                display: inline-flex !important;
                align-items: center !important;
                gap: 10px !important;
                flex-wrap: wrap !important;
            }
            .citd-teams-switcher-title {
                font-weight: 600 !important;
                font-size: 13px !important;
                color: var(--colorNeutralForeground2, #555555) !important;
                letter-spacing: 0.2px !important;
                white-space: nowrap !important;
                user-select: none !important;
            }
            .citd-teams-switcher-group {
                display: inline-flex !important;
                align-items: center !important;
                background: var(--colorNeutralBackground3, #f0f0f0) !important;
                padding: 3px !important;
                border-radius: 6px !important;
                gap: 2px !important;
            }
            .citd-teams-switch-btn {
                padding: 5px 14px !important;
                font-size: 13px !important;
                font-weight: 500 !important;
                line-height: 1.4 !important;
                border: none !important;
                border-radius: 4px !important;
                background: transparent !important;
                color: var(--colorNeutralForeground2, #424242) !important;
                cursor: pointer !important;
                transition: all 0.15s ease-in-out !important;
                user-select: none !important;
            }
            .citd-teams-switch-btn:hover {
                color: var(--colorNeutralForeground1, #111111) !important;
                background: var(--colorNeutralBackground3Hover, rgba(0, 0, 0, 0.06)) !important;
            }
            .citd-teams-switch-btn.active {
                background: var(--colorBrandBackground, #5b5fc7) !important;
                color: #ffffff !important;
                font-weight: 600 !important;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15) !important;
            }

            /* Nút Toggle Nhóm khác */
            .citd-teams-toggle-btn {
                display: inline-flex !important;
                align-items: center !important;
                gap: 6px !important;
                padding: 5px 12px !important;
                font-size: 12px !important;
                font-weight: 500 !important;
                border: 1px solid var(--colorNeutralStroke1, #d1d1d1) !important;
                border-radius: 6px !important;
                background: var(--colorNeutralBackground1, #ffffff) !important;
                color: var(--colorNeutralForeground2, #616161) !important;
                cursor: pointer !important;
                transition: all 0.15s ease !important;
                user-select: none !important;
            }
            .citd-teams-toggle-btn:hover {
                background: var(--colorNeutralBackground1Hover, #f5f5f5) !important;
                color: var(--colorNeutralForeground1, #111111) !important;
                border-color: var(--colorNeutralStroke1Hover, #b3b3b3) !important;
            }
            .citd-teams-toggle-btn.active {
                background: rgba(91, 95, 199, 0.08) !important;
                border-color: var(--colorBrandBackground, #5b5fc7) !important;
                color: var(--colorBrandBackground, #5b5fc7) !important;
                font-weight: 600 !important;
            }
            .citd-teams-toggle-status {
                display: inline-block !important;
                padding: 1px 7px !important;
                border-radius: 10px !important;
                font-size: 11px !important;
                font-weight: 600 !important;
                background: var(--colorNeutralBackground3, #e5e5e5) !important;
                color: var(--colorNeutralForeground2, #555555) !important;
            }
            .citd-teams-toggle-btn.active .citd-teams-toggle-status {
                background: rgba(91, 95, 199, 0.18) !important;
                color: #5b5fc7 !important;
            }

            /* Định dạng 3 phần cho thẻ môn học: Mã lớp - Tên môn - Giảng viên */
            .citd-card-title-box {
                display: flex !important;
                flex-direction: column !important;
                align-items: flex-start !important;
                text-align: left !important;
                width: 100% !important;
                margin-top: 4px !important;
                cursor: pointer !important;
                font-weight: 400 !important;
            }
            .citd-card-code-pill {
                display: inline-block !important;
                font-size: 11px !important;
                font-weight: 600 !important;
                color: var(--colorBrandForeground1, #5b5fc7) !important;
                background: rgba(91, 95, 199, 0.08) !important;
                padding: 1px 6px !important;
                border-radius: 4px !important;
                margin-bottom: 4px !important;
                letter-spacing: 0.1px !important;
                max-width: 100% !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                white-space: nowrap !important;
            }
            /* Tên môn TUYỆT ĐỐI KHÔNG IN ĐẬM: mặc định font-weight 400 (normal) */
            .citd-card-subject-title {
                font-size: 14px !important;
                font-weight: 400 !important;
                color: var(--colorNeutralForeground1, #242424) !important;
                line-height: 1.35 !important;
                display: -webkit-box !important;
                -webkit-line-clamp: 2 !important;
                -webkit-box-orient: vertical !important;
                overflow: hidden !important;
            }
            /* Chỉ in đậm khi MS Teams đánh dấu môn có cập nhật mới (unread activity) */
            .citd-card-subject-title.citd-unread {
                font-weight: 600 !important;
            }
            .citd-card-teacher-badge {
                font-size: 11px !important;
                font-weight: 500 !important;
                color: var(--colorNeutralForeground2, #555555) !important;
                display: inline-flex !important;
                align-items: center !important;
                gap: 4px !important;
                max-width: 100% !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                white-space: nowrap !important;
                padding: 2px 6px !important;
                border-radius: 4px !important;
                background: var(--colorNeutralBackground3, #f0f0f0) !important;
                border: 1px solid var(--colorNeutralStroke2, rgba(0, 0, 0, 0.06)) !important;
                flex-shrink: 1 !important;
                margin-left: auto !important;
            }

            /* Avatar hiển thị mã môn trên 1 dòng duy nhất, giữ nguyên kích thước 72x72 và màu nền chuẩn của Teams */
            .citd-avatar-subject-code {
                font-size: 16px !important;
                font-weight: 600 !important;
                letter-spacing: 0.5px !important;
                white-space: nowrap !important;
                color: #ffffff !important;
                text-align: center !important;
                line-height: 1 !important;
                user-select: none !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                width: 100% !important;
                height: 100% !important;
                border-radius: inherit !important;
            }
        `));
        document.head.appendChild(style);
    }

    // =========================================================================
    // 4. RENDER THANH SWITCHER BAR
    // =========================================================================
    function renderSwitcher(gridViewContainer) {
        let switcher = document.getElementById('citd-teams-switcher');
        if (!switcher) {
            switcher = document.createElement('div');
            switcher.id = 'citd-teams-switcher';
            switcher.className = 'citd-teams-switcher-bar';

            // Left group: Semester buttons
            const leftGroup = document.createElement('div');
            leftGroup.className = 'citd-teams-switcher-left';

            const title = document.createElement('span');
            title.className = 'citd-teams-switcher-title';
            title.textContent = 'Semester:';
            leftGroup.appendChild(title);

            const btnGroup = document.createElement('div');
            btnGroup.className = 'citd-teams-switcher-group';

            const semesters = ['HK5', 'HK4', 'HK3', 'HK2', 'HK1', 'ALL'];
            semesters.forEach(sem => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'citd-teams-switch-btn';
                btn.setAttribute('data-semester', sem);
                btn.textContent = sem;
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (sem === currentSemester) return;

                    currentSemester = sem;
                    localStorage.setItem('citd_teams_active_semester', currentSemester);
                    // Reset cache số lượng của học kỳ trước khi đổi sang học kỳ mới
                    document.querySelectorAll('[data-tid$="-header"]').forEach(h => {
                        delete h.dataset.citdLastCount;
                        delete h.dataset.citdHasCurrentCourses;
                    });
                    updateSwitcherActive(switcher);
                    processTeams();
                });
                btnGroup.appendChild(btn);
            });
            leftGroup.appendChild(btnGroup);

            // Right group: Toggle other teams (Non-course teams)
            const rightGroup = document.createElement('div');
            rightGroup.className = 'citd-teams-switcher-right';

            const toggleOtherBtn = document.createElement('button');
            toggleOtherBtn.type = 'button';
            toggleOtherBtn.className = 'citd-teams-toggle-btn';
            toggleOtherBtn.id = 'citd-teams-toggle-other';
            toggleOtherBtn.title = 'Show or hide other teams (non-course teams)';

            const toggleLabel = document.createTextNode('Other teams: ');
            toggleOtherBtn.appendChild(toggleLabel);

            const toggleStatus = document.createElement('span');
            toggleStatus.className = 'citd-teams-toggle-status';
            toggleStatus.textContent = showOtherTeams ? 'Show' : 'Hide';
            toggleOtherBtn.appendChild(toggleStatus);

            toggleOtherBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showOtherTeams = !showOtherTeams;
                localStorage.setItem('citd_teams_show_other', String(showOtherTeams));
                updateOtherTeamsToggle(toggleOtherBtn);
                processTeams();
            });
            rightGroup.appendChild(toggleOtherBtn);

            switcher.appendChild(leftGroup);
            switcher.appendChild(rightGroup);

            // Chèn thanh switcher TRƯỚC gridViewContainer để nằm ngang phía trên toàn bộ danh sách lớp
            if (gridViewContainer.parentElement) {
                gridViewContainer.parentElement.insertBefore(switcher, gridViewContainer);
            } else {
                gridViewContainer.insertBefore(switcher, gridViewContainer.firstChild);
            }
        } else {
            // Đảm bảo switcher luôn nằm ngay phía trước gridViewContainer nếu DOM có sự xáo trộn
            if (gridViewContainer.parentElement && switcher.nextElementSibling !== gridViewContainer) {
                gridViewContainer.parentElement.insertBefore(switcher, gridViewContainer);
            }
        }

        updateSwitcherActive(switcher);
        const toggleOtherBtn = switcher.querySelector('#citd-teams-toggle-other');
        if (toggleOtherBtn) {
            updateOtherTeamsToggle(toggleOtherBtn);
        }
    }

    function updateSwitcherActive(switcher) {
        switcher.querySelectorAll('.citd-teams-switch-btn').forEach(btn => {
            if (btn.getAttribute('data-semester') === currentSemester) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    function updateOtherTeamsToggle(btn) {
        const statusEl = btn.querySelector('.citd-teams-toggle-status');
        if (showOtherTeams) {
            btn.classList.add('active');
            if (statusEl) statusEl.textContent = 'Show';
        } else {
            btn.classList.remove('active');
            if (statusEl) statusEl.textContent = 'Hide';
        }
    }

    // =========================================================================
    // 5. LOẠI BỎ BADGE HỌC KỲ THEO YÊU CẦU
    // =========================================================================
    function removeBadges() {
        document.querySelectorAll('.citd-teams-semester-badge').forEach(b => b.remove());
    }

    // =========================================================================
    // 6. XỬ LÝ LỌC & SẮP XẾP MÔN HỌC
    // =========================================================================
    const NATIVE_SECTION_TITLES = {
        ClassTeamsSection: 'Classes',
        OtherTeamsSection: 'Teams',
        HiddenTeamsSection: 'Hidden'
    };

    /**
     * Xác định xem người dùng có đang ở đúng ứng dụng Teams (App "Teams")
     * và đang ở màn hình danh sách lớp học (teams-grid-view) hay không.
     * Khi người dùng chuyển sang Chat, Activity, Calendar, Calls, OneDrive,...
     * hàm này sẽ trả về false để ẩn bộ lọc và không can thiệp vào các app khác.
     */
    function isTeamsAppActive() {
        // 1. Kiểm tra trên thanh điều hướng ứng dụng bên trái (App Bar / Navigation)
        const appNav = document.querySelector('[role="navigation"][aria-label="Apps"], [aria-label="Apps"]');
        if (appNav) {
            // Tìm nút ứng dụng Teams trên App Bar
            const teamsBtn = appNav.querySelector('button[aria-label="Teams"], button[aria-label="Nhóm"], button[data-tid="2a84919f-59d8-4441-a975-2a8c2643b741"]');
            if (teamsBtn) {
                // Nếu nút Teams không được chọn (aria-pressed !== 'true'), người dùng đang ở app khác (Chat, Calendar,...)
                if (teamsBtn.getAttribute('aria-pressed') !== 'true') {
                    return false;
                }
            } else {
                // Kiểm tra nếu có bất kỳ app button nào khác đang active (aria-pressed="true")
                const activeBtn = appNav.querySelector('button[aria-pressed="true"]');
                if (activeBtn) {
                    const label = (activeBtn.getAttribute('aria-label') || activeBtn.textContent || '').trim().toLowerCase();
                    if (label && !label.includes('team') && !label.includes('nhóm')) {
                        return false;
                    }
                }
            }
        }

        // 2. Kiểm tra xem có đang ở trang danh sách nhóm (teams-grid-view) hay không
        const gridView = document.querySelector('[data-tid="teams-grid-view"]');
        if (!gridView) {
            return false;
        }

        // Nếu gridView bị ẩn (display: none hoặc thuộc tính hidden)
        if (gridView.closest('[style*="display: none"], [style*="display:none"], [hidden]')) {
            return false;
        }

        return true;
    }

    let isProcessing = false;
    let isInternalUpdating = false;
    let debounceTimer = null;

    function processTeams() {
        if (isInternalUpdating) return;
        isInternalUpdating = true;

        try {
            const switcher = document.getElementById('citd-teams-switcher');

            // NẾU KHÔNG Ở APP TEAMS HOẶC KHÔNG Ở MÀN HÌNH DANH SÁCH LỚP:
            // Ẩn thanh switcher ngay lập tức và dừng mọi can thiệp
            if (!isTeamsAppActive()) {
                if (switcher) {
                    switcher.style.setProperty('display', 'none', 'important');
                }
                return;
            }

            // Nếu đang ở app Teams: đảm bảo thanh switcher được hiển thị
            if (switcher) {
                switcher.style.removeProperty('display');
            }

            injectStyles();
            removeBadges();

            const gridView = document.querySelector('[data-tid="teams-grid-view"]');
            if (!gridView) return;

            renderSwitcher(gridView);

            // Lấy tất cả các thẻ môn học
            const allCards = Array.from(gridView.querySelectorAll('[role="group"][data-tid$="-team-card"]'));
            if (allCards.length === 0) return;

            const sections = [
                { id: 'ClassTeamsSection', isClasses: true, nativeTitle: 'Classes' },
                { id: 'OtherTeamsSection', isOther: true, nativeTitle: 'Teams' },
                { id: 'HiddenTeamsSection', isHidden: true, nativeTitle: 'Hidden' }
            ];

            // ---------------------------------------------------------------------
            // NẾU CHỌN TAB 'ALL': KHÔI PHỤC HOÀN TOÀN VỀ TRẠNG THÁI MẶC ĐỊNH CỦA TEAMS
            // ---------------------------------------------------------------------
            if (currentSemester === 'ALL') {
                allCards.forEach(card => {
                    restoreCourseCard(card);

                    const col = getCardColumnItem(card);
                    if (col) {
                        col.style.display = '';
                        col.style.order = '';
                    }
                });

                // Khôi phục tất cả các section về mặc định (tiêu đề gốc: Classes, Teams, Hidden)
                sections.forEach(sec => {
                    const header = gridView.querySelector(`[data-tid="${sec.id}-header"]`);
                    if (!header) return;

                    const accordionItem = header.closest('.fui-AccordionItem');
                    if (accordionItem) {
                        accordionItem.style.display = '';
                        delete accordionItem.dataset.citdExpandedForSemester;
                    }

                    const titleEl = header.querySelector('.fui-StyledText');
                    if (titleEl && sec.nativeTitle) {
                        titleEl.textContent = sec.nativeTitle;
                    }

                    const descEl = header.querySelector(`#${sec.id}-description`);
                    if (descEl && descEl.dataset.citdOriginalDesc) {
                        descEl.textContent = descEl.dataset.citdOriginalDesc;
                    }
                });

                return;
            }

            // ---------------------------------------------------------------------
            // NẾU CHỌN TỪNG HỌC KỲ CỤ THỂ (HK1 - HK5): LỌC & SẮP XẾP THEO TKB
            // Áp dụng Visual Section Mapping an toàn 100% với React DOM (Không di chuyển
            // DOM node giữa các panel để tránh gây crash React Fiber của Teams).
            // Mục Hidden được đổi tên thành Classes (HK...) nếu chứa môn học, hoặc ẩn hoàn toàn!
            // ---------------------------------------------------------------------
            let visibleInClasses = 0;
            let visibleInHidden = 0;

            allCards.forEach(card => {
                let titleText = card.dataset.citdOriginalTitle;
                if (!titleText) {
                    const nameBtn = card.querySelector('[data-testid="team-name"]');
                    const styledText = nameBtn ? nameBtn.querySelector('.fui-StyledText') : null;
                    const rawAria = nameBtn?.getAttribute('aria-label') || card.getAttribute('aria-label') || '';
                    titleText = rawAria || (styledText ? styledText.textContent : '') || (nameBtn ? nameBtn.textContent : '') || '';
                    if (titleText) card.dataset.citdOriginalTitle = titleText;
                }

                const courseInfo = findCourseInfo(titleText);
                const sectionId = getCardSectionId(card);
                const col = getCardColumnItem(card);
                if (!col) return;

                if (courseInfo) {
                    // Là môn học chính khóa UIT
                    if (currentSemester === courseInfo.semester) {
                        formatCourseCard(card, titleText);
                        col.style.display = '';
                        col.style.order = String(courseInfo.index);
                        if (sectionId === 'ClassTeamsSection') {
                            visibleInClasses++;
                        } else if (sectionId === 'HiddenTeamsSection') {
                            visibleInHidden++;
                        }
                    } else {
                        restoreCourseCard(card);
                        col.style.display = 'none';
                        col.style.order = String(1000 + courseInfo.index);
                    }
                } else {
                    // Không phải môn học chính khóa UIT (nhóm lớp, hoạt động, thông báo...)
                    restoreCourseCard(card);
                    if (sectionId === 'OtherTeamsSection') {
                        col.style.display = showOtherTeams ? '' : 'none';
                        col.style.order = '9999';
                    } else {
                        col.style.display = 'none';
                        col.style.order = '9999';
                    }
                }
            });

            // =====================================================================
            // QUẢN LÝ ACCORDION SECTIONS CHO HỌC KỲ ĐƯỢC CHỌN (VISUAL MAPPING)
            // =====================================================================
            const isHK5 = currentSemester === 'HK5';

            // 1. ClassTeamsSection: Đại diện cho HK5 (luôn hiển thị khi chọn HK5, dù đóng hay mở)
            const classHeader = gridView.querySelector('[data-tid="ClassTeamsSection-header"]');
            if (classHeader) {
                const item = classHeader.closest('.fui-AccordionItem');
                if (item) {
                    if (isHK5) {
                        item.style.display = '';
                        const titleEl = classHeader.querySelector('.fui-StyledText');
                        if (titleEl) {
                            titleEl.textContent = 'Classes (HK5)';
                        }
                        const descEl = classHeader.querySelector('#ClassTeamsSection-description');
                        if (descEl) {
                            if (!descEl.dataset.citdOriginalDesc) {
                                descEl.dataset.citdOriginalDesc = descEl.textContent;
                            }
                            const count = visibleInClasses > 0 ? visibleInClasses : 4;
                            descEl.textContent = `${count} team${count > 1 ? 's' : ''}`;
                        }
                        // Tự động mở panel khi vừa mới chuyển tab sang HK5 lần đầu
                        if (item.dataset.citdExpandedForSemester !== 'HK5') {
                            const panel = item.querySelector('.fui-AccordionPanel, [data-tid$="-panel"]');
                            if (panel) panel.style.display = '';
                            const btn = classHeader.querySelector('button');
                            if (btn) btn.setAttribute('aria-expanded', 'true');
                            item.dataset.citdExpandedForSemester = 'HK5';
                        }
                    } else {
                        item.style.display = 'none';
                        delete item.dataset.citdExpandedForSemester;
                        const titleEl = classHeader.querySelector('.fui-StyledText');
                        if (titleEl) {
                            titleEl.textContent = 'Classes';
                        }
                    }
                }
            }

            // 2. HiddenTeamsSection: Đại diện cho HK1 - HK4 (luôn hiển thị khi chọn HK1..HK4, dù đóng hay mở)
            // CHUYỂN TÊN THÀNH Classes (HK...) VÀ HIỂN THỊ! TUYỆT ĐỐI KHÔNG CÓ CHỮ Hidden!
            const hiddenHeader = gridView.querySelector('[data-tid="HiddenTeamsSection-header"]');
            if (hiddenHeader) {
                const item = hiddenHeader.closest('.fui-AccordionItem');
                if (item) {
                    if (!isHK5) {
                        item.style.display = '';
                        const titleEl = hiddenHeader.querySelector('.fui-StyledText');
                        if (titleEl) {
                            titleEl.textContent = `Classes (${currentSemester})`;
                        }
                        const descEl = hiddenHeader.querySelector('#HiddenTeamsSection-description');
                        if (descEl) {
                            if (!descEl.dataset.citdOriginalDesc) {
                                descEl.dataset.citdOriginalDesc = descEl.textContent;
                            }
                            const expectedCount = SEMESTER_COURSES[currentSemester]?.length || 5;
                            const count = visibleInHidden > 0 ? visibleInHidden : expectedCount;
                            descEl.textContent = `${count} team${count > 1 ? 's' : ''}`;
                        }

                        // Tự động mở panel khi vừa mới chuyển tab sang học kỳ này lần đầu
                        if (item.dataset.citdExpandedForSemester !== currentSemester) {
                            const panel = item.querySelector('.fui-AccordionPanel, [data-tid$="-panel"]');
                            if (panel) panel.style.display = '';
                            const btn = hiddenHeader.querySelector('button');
                            if (btn) btn.setAttribute('aria-expanded', 'true');
                            item.dataset.citdExpandedForSemester = currentSemester;
                        }
                    } else {
                        item.style.display = 'none';
                        delete item.dataset.citdExpandedForSemester;
                        const titleEl = hiddenHeader.querySelector('.fui-StyledText');
                        if (titleEl) {
                            titleEl.textContent = 'Hidden';
                        }
                    }
                }
            }

            // 3. OtherTeamsSection: Chỉ hiển thị khi bật "Other teams: Show"
            const otherHeader = gridView.querySelector('[data-tid="OtherTeamsSection-header"]');
            if (otherHeader) {
                const item = otherHeader.closest('.fui-AccordionItem');
                if (item) {
                    item.style.display = showOtherTeams ? '' : 'none';
                    const titleEl = otherHeader.querySelector('.fui-StyledText');
                    if (titleEl) {
                        titleEl.textContent = 'Other teams';
                    }
                }
            }
        } finally {
            // Giải phóng cờ mutex sau 60ms để ngăn observer bắt lại các thay đổi do chính script tạo
            setTimeout(() => {
                isInternalUpdating = false;
            }, 60);
        }
    }

    // =========================================================================
    // 8. DEBOUNCED OBSERVER THEO DÕI DOM SPA TEAMS
    // =========================================================================
    function triggerProcess() {
        if (isProcessing || isInternalUpdating) return;
        if (debounceTimer) clearTimeout(debounceTimer);

        debounceTimer = setTimeout(() => {
            if (isInternalUpdating) return;
            isProcessing = true;
            try {
                processTeams();
            } catch (err) {
                console.error('[CITD Teams Filter] Error during processing:', err && (err.stack || err.message) ? (err.stack || err.message) : err);
            } finally {
                setTimeout(() => {
                    isProcessing = false;
                }, 80);
            }
        }, 150);
    }

    const observer = new MutationObserver((mutations) => {
        if (isInternalUpdating) return;

        let shouldTrigger = false;
        for (let i = 0; i < mutations.length; i++) {
            const m = mutations[i];
            const el = m.target;
            if (!el || el.nodeType !== 1) continue;

            // Bỏ qua các thành phần do chính userscript tạo ra
            if (el.id === 'citd-teams-switcher' || el.closest?.('#citd-teams-switcher')) {
                continue;
            }

            // Bỏ qua các mutation trên các thẻ do userscript tạo
            if (el.matches?.('.citd-card-title-box, .citd-card-code-pill, .citd-card-subject-title, .citd-card-teacher-badge, .citd-avatar-subject-code') ||
                el.closest?.('.citd-card-title-box, .citd-card-teacher-badge')) {
                continue;
            }

            // Chỉ kích hoạt khi có thay đổi liên quan đến lưới môn học, App Bar hoặc khi lưới đã mount nhưng chưa gắn switcher
            if (
                el.matches?.('[data-tid="teams-grid-view"], [data-app-name="schoolteams"], [data-tid$="TeamsSection-panel"], .fui-Accordion, .fui-AccordionPanel, [role="navigation"][aria-label="Apps"], [aria-label="Apps"]') ||
                el.closest?.('[data-tid="teams-grid-view"], [data-app-name="schoolteams"], [role="navigation"][aria-label="Apps"]') ||
                (document.querySelector('[data-tid="teams-grid-view"]') && !document.getElementById('citd-teams-switcher'))
            ) {
                shouldTrigger = true;
                break;
            }
        }

        if (shouldTrigger) {
            triggerProcess();
        }
    });

    // Chỉ theo dõi childList trên DOM để phát hiện component mount/unmount, không theo dõi attributes trên toàn body (tiết kiệm CPU)
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    function updateAppVisibility() {
        const switcher = document.getElementById('citd-teams-switcher');
        const active = isTeamsAppActive();
        if (!active) {
            if (switcher) {
                switcher.style.setProperty('display', 'none', 'important');
            }
            return false;
        }
        if (switcher) {
            switcher.style.removeProperty('display');
        }
        return true;
    }

    // Lắng nghe sự kiện click trên thanh điều hướng App Bar để phản hồi tức thì khi người dùng chuyển app
    document.addEventListener('click', (e) => {
        const appBtn = e.target.closest?.('[role="navigation"][aria-label="Apps"] button, [aria-label="Apps"] button');
        if (appBtn) {
            setTimeout(() => {
                const isTeams = updateAppVisibility();
                if (isTeams) {
                    triggerProcess();
                }
            }, 30);
        }
    }, true);

    // Khởi chạy ban đầu
    triggerProcess();
})();
