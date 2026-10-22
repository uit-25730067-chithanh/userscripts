// ==UserScript==
// @name         Hide & Sort Courses - CITD Elearning (Edge Optimized)
// @namespace    Violentmonkey Scripts
// @version      2.8
// @description  Lọc và sắp xếp môn học theo học kỳ HK1 - HK5 và All, quản lý ẩn/hiện Thông tin chung (Tối ưu cho Edge)
// @author       Dang Chi Thanh
// @match        https://elearning.citd.edu.vn/*
// @icon         https://elearning.citd.edu.vn/pluginfile.php/1/core_admin/favicon/64x64/1792598887/favicon.png
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 1. CHẶN TRANG CON (Chỉ chạy ở trang chủ hoặc index.php)
    const path = window.location.pathname;
    if (path !== '/' && path !== '/index.php') {
        return;
    }

    // =========================================================================
    // 2. DANH MỤC MÔN HỌC THEO TỪNG HỌC KỲ (Đúng thứ tự kênh Discord [29] -> [01])
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

    // =========================================================================
    // 3. CẤU HÌNH CÁC COMPONENT BỊ ẨN & QUẢN LÝ BẰNG SWITCH
    // =========================================================================
    const HIDDEN_COMPONENTS_CONFIG = {
        generalInfo: {
            title: 'Thông tin chung',
            storageKey: 'citd_show_general_info',
            selectors: [
                'ul.topics.frontpage',
                '#section-1',
                '.course-section[data-sectionid="1"]'
            ]
        }
    };

    const VALID_SEMESTERS = ['HK5', 'HK4', 'HK3', 'HK2', 'HK1', 'ALL'];
    let currentSemester = localStorage.getItem('citd_active_semester') || 'HK5';
    if (!VALID_SEMESTERS.includes(currentSemester)) {
        currentSemester = 'HK5';
    }

    // Trạng thái hiển thị mục Thông tin chung (Mặc định: false = Ẩn)
    let showGeneralInfo = localStorage.getItem(HIDDEN_COMPONENTS_CONFIG.generalInfo.storageKey) === 'true';

    function matchCourse(text, item) {
        if (!text) return false;
        if (text.includes(item.code)) return true;
        if (item.alt && text.includes(item.alt)) return true;
        return false;
    }

    function findSemesterForText(text) {
        for (const sem of ['HK5', 'HK4', 'HK3', 'HK2', 'HK1']) {
            if (SEMESTER_COURSES[sem].some(item => matchCourse(text, item))) {
                return sem;
            }
        }
        return null;
    }

    // =========================================================================
    // 4. INJECT STYLES
    // =========================================================================
    function injectStyles() {
        if (document.getElementById('citd-custom-styles')) return;

        const style = document.createElement('style');
        style.id = 'citd-custom-styles';
        style.textContent = `
            /* Tối ưu padding đều cho khung nội dung chính */
            #topofscroll,
            #topofscroll.main-inner {
                padding: 0.5rem !important;
            }

            /* Bảng Tips bên trong khối Thông tin chung */
            .activity-grid.noname-grid:has(a[href*="cong-cu-hoc-tap"]),
            .activity-grid.noname-grid:has(caption:contains("Tips")) {
                display: none !important;
            }

            /* Loại bỏ thẻ <br> lạc quẻ ngay liền sau khung tìm kiếm */
            .box.py-3 + br,
            .box:has(> .simplesearchform) + br {
                display: none !important;
            }

            .citd-switcher-bar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 12px;
                margin: 15px 0 20px 0;
                padding: 10px 16px;
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
            }
            .citd-switcher-left {
                display: flex;
                align-items: center;
                gap: 12px;
                flex-wrap: wrap;
            }
            .citd-switcher-right {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .citd-switcher-title {
                font-weight: 700;
                font-size: 13px;
                color: #475569;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                white-space: nowrap;
            }
            .citd-switcher-group {
                display: inline-flex;
                background: #e2e8f0;
                padding: 3px;
                border-radius: 6px;
                gap: 3px;
                flex-wrap: wrap;
            }
            .citd-switch-btn {
                padding: 5px 13px;
                font-size: 13px;
                font-weight: 600;
                border: none;
                border-radius: 5px;
                background: transparent;
                color: #64748b;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .citd-switch-btn:hover {
                color: #0f172a;
            }
            .citd-switch-btn.active {
                background: #ffffff;
                color: rgb(15, 108, 191);
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
            }

            /* Switch toggle cho Thông tin chung */
            .citd-toggle-btn {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 5px 12px;
                font-size: 12px;
                font-weight: 600;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                background: #ffffff;
                color: #64748b;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .citd-toggle-btn:hover {
                background: #f1f5f9;
                color: #0f172a;
                border-color: #94a3b8;
            }
            .citd-toggle-btn.active {
                background: #eff6ff;
                border-color: #93c5fd;
                color: rgb(15, 108, 191);
            }
            .citd-toggle-status {
                font-weight: 700;
            }

            .citd-semester-badge {
                display: inline-block;
                padding: 2px 7px;
                font-size: 11px;
                font-weight: 700;
                border-radius: 4px;
                margin-right: 8px;
                vertical-align: middle;
                letter-spacing: 0.5px;
                line-height: 1.2;
                color: #ffffff !important;
            }
            .citd-badge-hk5 { background: #0284c7; }
            .citd-badge-hk4 { background: rgb(15, 108, 191); }
            .citd-badge-hk3 { background: #0d9488; }
            .citd-badge-hk2 { background: #7c3aed; }
            .citd-badge-hk1 { background: #64748b; }
        `;
        document.head.appendChild(style);
    }

    // =========================================================================
    // 5. TẠO SWITCHER CONTROL (Bộ lọc học kỳ & Nút bật/tắt Thông tin chung)
    // =========================================================================
    function renderSwitcher(courseList) {
        let switcher = document.getElementById('citd-semester-switcher');
        if (!switcher) {
            switcher = document.createElement('div');
            switcher.id = 'citd-semester-switcher';
            switcher.className = 'citd-switcher-bar';
            switcher.innerHTML = `
                <div class="citd-switcher-left">
                    <span class="citd-switcher-title">Bộ lọc học kỳ:</span>
                    <div class="citd-switcher-group">
                        <button type="button" class="citd-switch-btn" data-semester="HK5">HK5</button>
                        <button type="button" class="citd-switch-btn" data-semester="HK4">HK4</button>
                        <button type="button" class="citd-switch-btn" data-semester="HK3">HK3</button>
                        <button type="button" class="citd-switch-btn" data-semester="HK2">HK2</button>
                        <button type="button" class="citd-switch-btn" data-semester="HK1">HK1</button>
                        <button type="button" class="citd-switch-btn" data-semester="ALL">All</button>
                    </div>
                </div>
                <div class="citd-switcher-right">
                    <button type="button" class="citd-toggle-btn" id="citd-toggle-general-info" title="Bật/tắt hiển thị khối Thông tin chung ở đầu trang">
                        Thông tin chung: <span class="citd-toggle-status">Ẩn</span>
                    </button>
                </div>
            `;

            // Lắng nghe sự kiện đổi học kỳ
            switcher.querySelectorAll('.citd-switch-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const selected = btn.getAttribute('data-semester');
                    if (selected === currentSemester) return;

                    currentSemester = selected;
                    localStorage.setItem('citd_active_semester', currentSemester);
                    updateSwitcherActive(switcher);
                    processCourses();
                });
            });

            // Lắng nghe sự kiện bật/tắt Thông tin chung
            const toggleGeneralBtn = switcher.querySelector('#citd-toggle-general-info');
            if (toggleGeneralBtn) {
                toggleGeneralBtn.addEventListener('click', () => {
                    showGeneralInfo = !showGeneralInfo;
                    localStorage.setItem(HIDDEN_COMPONENTS_CONFIG.generalInfo.storageKey, String(showGeneralInfo));
                    updateGeneralInfoToggle(toggleGeneralBtn);
                    applyHiddenComponents();
                });
            }

            courseList.parentNode.insertBefore(switcher, courseList);
        }

        updateSwitcherActive(switcher);
        const toggleGeneralBtn = switcher.querySelector('#citd-toggle-general-info');
        if (toggleGeneralBtn) {
            updateGeneralInfoToggle(toggleGeneralBtn);
        }
    }

    function updateSwitcherActive(switcher) {
        switcher.querySelectorAll('.citd-switch-btn').forEach(btn => {
            if (btn.getAttribute('data-semester') === currentSemester) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    function updateGeneralInfoToggle(btn) {
        const statusEl = btn.querySelector('.citd-toggle-status');
        if (showGeneralInfo) {
            btn.classList.add('active');
            if (statusEl) statusEl.textContent = 'Hiện';
        } else {
            btn.classList.remove('active');
            if (statusEl) statusEl.textContent = 'Ẩn';
        }
    }

    // =========================================================================
    // 6. XỬ LÝ ẨN / HIỆN CÁC COMPONENT PHỤ (THÔNG TIN CHUNG)
    // =========================================================================
    function applyHiddenComponents() {
        const selectorStr = HIDDEN_COMPONENTS_CONFIG.generalInfo.selectors.join(', ');
        document.querySelectorAll(selectorStr).forEach(el => {
            const targetDisplay = showGeneralInfo ? '' : 'none';
            if (el.style.display !== targetDisplay) {
                el.style.display = targetDisplay;
            }
        });
    }

    // =========================================================================
    // 7. GẮN BADGE CHO TỪNG MÔN HỌC
    // =========================================================================
    function attachBadge(coursenameEl, semester) {
        const existingBadge = coursenameEl.querySelector('.citd-semester-badge');
        if (existingBadge) {
            if (existingBadge.textContent !== semester) {
                existingBadge.className = `citd-semester-badge citd-badge-${semester.toLowerCase()}`;
                existingBadge.textContent = semester;
            }
            return;
        }

        const badge = document.createElement('span');
        badge.className = `citd-semester-badge citd-badge-${semester.toLowerCase()}`;
        badge.textContent = semester;

        const link = coursenameEl.querySelector('a.aalink');
        if (link) {
            coursenameEl.insertBefore(badge, link);
        } else {
            coursenameEl.prepend(badge);
        }
    }

    // =========================================================================
    // 8. XỬ LÝ LỌC VÀ SẮP XẾP MÔN HỌC
    // =========================================================================
    function processCourses() {
        injectStyles();
        applyHiddenComponents();

        const courseList = document.querySelector('.frontpage-course-list-enrolled');
        if (!courseList) return;

        renderSwitcher(courseList);

        // Danh sách môn mục tiêu cần hiển thị theo bộ lọc
        let targetList = [];
        if (currentSemester === 'ALL') {
            targetList = [
                ...SEMESTER_COURSES.HK5,
                ...SEMESTER_COURSES.HK4,
                ...SEMESTER_COURSES.HK3,
                ...SEMESTER_COURSES.HK2,
                ...SEMESTER_COURSES.HK1
            ];
        } else if (SEMESTER_COURSES[currentSemester]) {
            targetList = SEMESTER_COURSES[currentSemester];
        }

        const allBoxes = Array.from(courseList.querySelectorAll('.coursebox'));

        // 8.1. Gắn badge & ẩn/hiện môn học
        allBoxes.forEach(box => {
            const link = box.querySelector('.coursename a.aalink');
            if (!link) return;

            const text = link.dataset.citdOriginalTitle || link.textContent.trim();
            link.dataset.citdOriginalTitle = text;

            const coursenameEl = box.querySelector('.coursename');
            const courseSemester = findSemesterForText(text);

            if (courseSemester && coursenameEl) {
                attachBadge(coursenameEl, courseSemester);
            }

            let shouldShow = false;
            if (currentSemester === 'ALL') {
                shouldShow = courseSemester !== null;
            } else {
                shouldShow = courseSemester === currentSemester;
            }

            const newDisplay = shouldShow ? '' : 'none';
            if (box.style.display !== newDisplay) {
                box.style.display = newDisplay;
            }
        });

        // 8.2. Sắp xếp lại thứ tự DOM
        const pagingNode = courseList.querySelector('.paging');
        targetList.forEach(courseItem => {
            const targetBox = allBoxes.find(box => {
                const link = box.querySelector('.coursename a.aalink');
                const title = link ? (link.dataset.citdOriginalTitle || link.textContent) : '';
                return matchCourse(title, courseItem);
            });

            if (targetBox) {
                if (pagingNode) {
                    courseList.insertBefore(targetBox, pagingNode);
                } else {
                    courseList.appendChild(targetBox);
                }
            }
        });
    }

    // =========================================================================
    // 9. OBSERVER THEO DÕI DOM DYNAMIC
    // =========================================================================
    let isProcessing = false;
    const observer = new MutationObserver(() => {
        if (isProcessing) return;

        isProcessing = true;
        processCourses();

        setTimeout(() => {
            isProcessing = false;
        }, 80);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Khởi chạy
    processCourses();
})();
