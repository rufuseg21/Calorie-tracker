/* ============================================
   NutriFlow — Calorie & Macro Tracker
   Application Logic (Vanilla JS)
   ============================================ */

(function () {
    'use strict';

    // ========================
    // Constants & Config
    // ========================
    const STORAGE_KEYS = {
        ENTRIES: 'nutriflow_entries',
        GOALS: 'nutriflow_goals',
    };

    const DEFAULT_GOALS = {
        calories: 2000,
        protein: 150,
        carbs: 250,
        fat: 65,
    };

    const MEAL_LABELS = {
        breakfast: 'Breakfast',
        lunch: 'Lunch',
        dinner: 'Dinner',
        snack: 'Snack',
    };

    // ========================
    // State
    // ========================
    let currentDate = getTodayString();
    let activeFilter = 'all';
    let confirmCallback = null;

    // ========================
    // DOM References
    // ========================
    const dom = {
        // Header
        dateText: document.getElementById('date-text'),
        datePrevBtn: document.getElementById('date-prev-btn'),
        dateNextBtn: document.getElementById('date-next-btn'),
        dateDisplayBtn: document.getElementById('date-display-btn'),
        datePicker: document.getElementById('date-picker'),
        settingsBtn: document.getElementById('settings-btn'),

        // Dashboard
        caloriesConsumed: document.getElementById('calories-consumed'),
        caloriesGoal: document.getElementById('calories-goal'),
        caloriesRemaining: document.getElementById('calories-remaining'),
        calorieRing: document.getElementById('calorie-ring'),

        proteinCurrent: document.getElementById('protein-current'),
        proteinTarget: document.getElementById('protein-target'),
        proteinBar: document.getElementById('protein-bar'),
        carbsCurrent: document.getElementById('carbs-current'),
        carbsTarget: document.getElementById('carbs-target'),
        carbsBar: document.getElementById('carbs-bar'),
        fatCurrent: document.getElementById('fat-current'),
        fatTarget: document.getElementById('fat-target'),
        fatBar: document.getElementById('fat-bar'),

        // Form
        addFoodForm: document.getElementById('add-food-form'),
        foodName: document.getElementById('food-name'),
        foodCalories: document.getElementById('food-calories'),
        foodProtein: document.getElementById('food-protein'),
        foodCarbs: document.getElementById('food-carbs'),
        foodFat: document.getElementById('food-fat'),
        foodMeal: document.getElementById('food-meal'),

        // Food Log
        foodList: document.getElementById('food-list'),
        emptyState: document.getElementById('empty-state'),
        filterTabs: document.getElementById('log-filter-tabs'),

        // Chart
        weeklyChart: document.getElementById('weekly-chart'),

        // Settings Modal
        settingsModal: document.getElementById('settings-modal'),
        settingsForm: document.getElementById('settings-form'),
        settingsCloseBtn: document.getElementById('settings-close-btn'),
        goalCalories: document.getElementById('goal-calories'),
        goalProtein: document.getElementById('goal-protein'),
        goalCarbs: document.getElementById('goal-carbs'),
        goalFat: document.getElementById('goal-fat'),
        clearTodayBtn: document.getElementById('clear-today-btn'),
        clearAllBtn: document.getElementById('clear-all-btn'),

        // Confirm Modal
        confirmModal: document.getElementById('confirm-modal'),
        confirmMessage: document.getElementById('confirm-message'),
        confirmCancelBtn: document.getElementById('confirm-cancel-btn'),
        confirmOkBtn: document.getElementById('confirm-ok-btn'),

        // Toast
        toastContainer: document.getElementById('toast-container'),
    };

    // ========================
    // LocalStorage Helpers
    // ========================
    function loadEntries() {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.ENTRIES);
            if (!data) return {};
            const parsed = JSON.parse(data);
            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
            return parsed;
        } catch {
            return {};
        }
    }

    function saveEntries(entries) {
        try {
            localStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(entries));
        } catch {
            // Storage quota exceeded or unavailable
        }
    }

    function loadGoals() {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.GOALS);
            if (!data) return { ...DEFAULT_GOALS };
            const parsed = JSON.parse(data);
            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return { ...DEFAULT_GOALS };
            return {
                calories: sanitizeNumber(parsed.calories, 500, 10000, DEFAULT_GOALS.calories),
                protein: sanitizeNumber(parsed.protein, 0, 500, DEFAULT_GOALS.protein),
                carbs: sanitizeNumber(parsed.carbs, 0, 1000, DEFAULT_GOALS.carbs),
                fat: sanitizeNumber(parsed.fat, 0, 500, DEFAULT_GOALS.fat),
            };
        } catch {
            return { ...DEFAULT_GOALS };
        }
    }

    function saveGoals(goals) {
        try {
            localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goals));
        } catch {
            // Storage quota exceeded or unavailable
        }
    }

    // ========================
    // Validation & Sanitization
    // ========================
    function sanitizeNumber(value, min, max, fallback) {
        const num = Number(value);
        if (!Number.isFinite(num) || num < min || num > max) return fallback;
        return num;
    }

    function sanitizeText(text, maxLen) {
        if (typeof text !== 'string') return '';
        // Strip control characters and limit length
        return text.replace(/[\x00-\x1F\x7F]/g, '').trim().substring(0, maxLen);
    }

    function isValidDateString(str) {
        if (typeof str !== 'string') return false;
        return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(new Date(str + 'T00:00:00').getTime());
    }

    function isValidMeal(meal) {
        return ['breakfast', 'lunch', 'dinner', 'snack'].includes(meal);
    }

    // ========================
    // Date Utilities
    // ========================
    function getTodayString() {
        const d = new Date();
        return formatDateISO(d);
    }

    function formatDateISO(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function formatDateDisplay(dateStr) {
        const today = getTodayString();
        if (dateStr === today) return 'Today';

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (dateStr === formatDateISO(yesterday)) return 'Yesterday';

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (dateStr === formatDateISO(tomorrow)) return 'Tomorrow';

        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        });
    }

    function shiftDate(dateStr, days) {
        const date = new Date(dateStr + 'T00:00:00');
        date.setDate(date.getDate() + days);
        return formatDateISO(date);
    }

    // ========================
    // Generate unique IDs
    // ========================
    function generateId() {
        const array = new Uint8Array(12);
        crypto.getRandomValues(array);
        return Array.from(array, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    }

    // ========================
    // Data operations
    // ========================
    function getEntriesForDate(dateStr) {
        const entries = loadEntries();
        const dateEntries = entries[dateStr];
        if (!Array.isArray(dateEntries)) return [];
        // Validate each entry
        return dateEntries.filter(function (e) {
            return e && typeof e.id === 'string' && typeof e.name === 'string' && isValidMeal(e.meal);
        });
    }

    function addEntry(dateStr, entry) {
        const entries = loadEntries();
        if (!Array.isArray(entries[dateStr])) {
            entries[dateStr] = [];
        }
        entries[dateStr].push(entry);
        saveEntries(entries);
    }

    function removeEntry(dateStr, entryId) {
        const entries = loadEntries();
        if (!Array.isArray(entries[dateStr])) return;
        entries[dateStr] = entries[dateStr].filter(function (e) {
            return e.id !== entryId;
        });
        if (entries[dateStr].length === 0) {
            delete entries[dateStr];
        }
        saveEntries(entries);
    }

    function clearEntriesForDate(dateStr) {
        const entries = loadEntries();
        delete entries[dateStr];
        saveEntries(entries);
    }

    function clearAllEntries() {
        saveEntries({});
    }

    function computeDayTotals(dateStr) {
        const entries = getEntriesForDate(dateStr);
        return entries.reduce(function (acc, e) {
            acc.calories += sanitizeNumber(e.calories, 0, 99999, 0);
            acc.protein += sanitizeNumber(e.protein, 0, 99999, 0);
            acc.carbs += sanitizeNumber(e.carbs, 0, 99999, 0);
            acc.fat += sanitizeNumber(e.fat, 0, 99999, 0);
            return acc;
        }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
    }

    // ========================
    // UI Rendering
    // ========================
    function updateDashboard() {
        const goals = loadGoals();
        const totals = computeDayTotals(currentDate);

        // Calorie ring
        dom.caloriesConsumed.textContent = Math.round(totals.calories);
        dom.caloriesGoal.textContent = goals.calories;

        const remaining = goals.calories - totals.calories;
        dom.caloriesRemaining.textContent =
            remaining >= 0
                ? remaining + ' remaining'
                : Math.abs(Math.round(remaining)) + ' over goal';

        // Ring progress
        const circumference = 2 * Math.PI * 85;
        const progress = Math.min(totals.calories / goals.calories, 1);
        const offset = circumference - progress * circumference;
        dom.calorieRing.style.strokeDasharray = circumference;
        dom.calorieRing.style.strokeDashoffset = offset;

        // Update ring gradient color if over goal
        updateRingColor(totals.calories > goals.calories);

        // Macros
        updateMacro(dom.proteinCurrent, dom.proteinTarget, dom.proteinBar, totals.protein, goals.protein);
        updateMacro(dom.carbsCurrent, dom.carbsTarget, dom.carbsBar, totals.carbs, goals.carbs);
        updateMacro(dom.fatCurrent, dom.fatTarget, dom.fatBar, totals.fat, goals.fat);
    }

    function updateMacro(currentEl, targetEl, barEl, current, target) {
        currentEl.textContent = Math.round(current * 10) / 10;
        targetEl.textContent = target;
        const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
        barEl.style.width = pct + '%';
        barEl.setAttribute('aria-valuenow', Math.round(pct));
    }

    function updateRingColor(isOver) {
        // Dynamically set ring stroke color
        if (isOver) {
            dom.calorieRing.style.stroke = '#ef4444';
            dom.calorieRing.style.filter = 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.4))';
        } else {
            dom.calorieRing.style.stroke = '';
            dom.calorieRing.style.filter = '';
        }
    }

    function renderFoodLog() {
        const entries = getEntriesForDate(currentDate);
        const filtered = activeFilter === 'all'
            ? entries
            : entries.filter(function (e) { return e.meal === activeFilter; });

        // Clear list safely
        dom.foodList.replaceChildren();

        if (filtered.length === 0) {
            dom.emptyState.classList.remove('hidden');
            dom.foodList.style.display = 'none';
        } else {
            dom.emptyState.classList.add('hidden');
            dom.foodList.style.display = '';
            filtered.forEach(function (entry, index) {
                var item = createFoodItemElement(entry);
                item.style.animationDelay = (index * 50) + 'ms';
                dom.foodList.appendChild(item);
            });
        }
    }

    function createFoodItemElement(entry) {
        var item = document.createElement('div');
        item.classList.add('food-item');
        item.setAttribute('role', 'listitem');
        item.dataset.id = entry.id;

        // Meal dot
        var dot = document.createElement('div');
        dot.classList.add('food-meal-dot', entry.meal);
        dot.title = MEAL_LABELS[entry.meal] || '';
        item.appendChild(dot);

        // Details
        var details = document.createElement('div');
        details.classList.add('food-details');

        var nameEl = document.createElement('div');
        nameEl.classList.add('food-name');
        nameEl.textContent = entry.name;
        details.appendChild(nameEl);

        var macrosInline = document.createElement('div');
        macrosInline.classList.add('food-macros-inline');

        var pTag = document.createElement('span');
        pTag.classList.add('food-macro-tag');
        pTag.textContent = 'P: ' + (Math.round((entry.protein || 0) * 10) / 10) + 'g';
        macrosInline.appendChild(pTag);

        var cTag = document.createElement('span');
        cTag.classList.add('food-macro-tag');
        cTag.textContent = 'C: ' + (Math.round((entry.carbs || 0) * 10) / 10) + 'g';
        macrosInline.appendChild(cTag);

        var fTag = document.createElement('span');
        fTag.classList.add('food-macro-tag');
        fTag.textContent = 'F: ' + (Math.round((entry.fat || 0) * 10) / 10) + 'g';
        macrosInline.appendChild(fTag);

        details.appendChild(macrosInline);
        item.appendChild(details);

        // Calories
        var calDisplay = document.createElement('div');
        calDisplay.classList.add('food-calories-display');
        calDisplay.textContent = Math.round(entry.calories);
        var calUnit = document.createElement('span');
        calUnit.classList.add('food-calories-unit');
        calUnit.textContent = 'kcal';
        calDisplay.appendChild(calUnit);
        item.appendChild(calDisplay);

        // Delete button
        var delBtn = document.createElement('button');
        delBtn.classList.add('food-delete-btn');
        delBtn.setAttribute('aria-label', 'Delete ' + entry.name);
        // Create SVG via DOMParser for safety
        var svgStr = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
        var parser = new DOMParser();
        var svgDoc = parser.parseFromString(svgStr, 'image/svg+xml');
        delBtn.appendChild(svgDoc.documentElement);

        delBtn.addEventListener('click', function () {
            removeEntry(currentDate, entry.id);
            refreshUI();
            showToast('Entry removed', 'success');
        });
        item.appendChild(delBtn);

        return item;
    }

    function updateDateDisplay() {
        dom.dateText.textContent = formatDateDisplay(currentDate);
        dom.datePicker.value = currentDate;

        // Update log title
        var logTitle = document.querySelector('.food-log-card .section-title');
        if (logTitle) {
            // Safely update text: clear and rebuild
            var svgChild = logTitle.querySelector('svg');
            logTitle.replaceChildren();
            if (svgChild) logTitle.appendChild(svgChild);
            logTitle.appendChild(document.createTextNode(' ' + formatDateDisplay(currentDate) + "'s Log"));
        }
    }

    function refreshUI() {
        updateDateDisplay();
        updateDashboard();
        renderFoodLog();
        drawWeeklyChart();
    }

    // ========================
    // Weekly Chart (Canvas)
    // ========================
    function drawWeeklyChart() {
        var canvas = dom.weeklyChart;
        var ctx = canvas.getContext('2d');

        // Set canvas size for retina
        var rect = canvas.parentElement.getBoundingClientRect();
        var dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        ctx.scale(dpr, dpr);

        var width = rect.width;
        var height = rect.height;
        var goals = loadGoals();

        // Get last 7 days of data
        var days = [];
        for (var i = 6; i >= 0; i--) {
            var dayStr = shiftDate(currentDate, -i);
            var totals = computeDayTotals(dayStr);
            var date = new Date(dayStr + 'T00:00:00');
            days.push({
                label: date.toLocaleDateString('en-US', { weekday: 'short' }),
                date: dayStr,
                calories: totals.calories,
                isToday: dayStr === currentDate,
            });
        }

        // Chart dimensions
        var padding = { top: 20, right: 16, bottom: 36, left: 40 };
        var chartW = width - padding.left - padding.right;
        var chartH = height - padding.top - padding.bottom;

        // Max value for Y axis
        var maxVal = Math.max(goals.calories * 1.2, ...days.map(function (d) { return d.calories; }));
        if (maxVal === 0) maxVal = goals.calories || 2000;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        var gridLines = 4;
        for (var g = 0; g <= gridLines; g++) {
            var gy = padding.top + (chartH / gridLines) * g;
            ctx.beginPath();
            ctx.moveTo(padding.left, gy);
            ctx.lineTo(width - padding.right, gy);
            ctx.stroke();

            // Y-axis labels
            var yVal = Math.round(maxVal - (maxVal / gridLines) * g);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(yVal, padding.left - 6, gy + 4);
        }

        // Draw goal line
        var goalY = padding.top + chartH - (goals.calories / maxVal) * chartH;
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding.left, goalY);
        ctx.lineTo(width - padding.right, goalY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Goal label
        ctx.fillStyle = 'rgba(99, 102, 241, 0.6)';
        ctx.font = '9px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Goal', padding.left + 4, goalY - 4);

        // Draw bars
        var barWidth = Math.min(chartW / days.length * 0.55, 40);
        var barSpacing = chartW / days.length;

        days.forEach(function (day, idx) {
            var x = padding.left + barSpacing * idx + barSpacing / 2 - barWidth / 2;
            var barH = (day.calories / maxVal) * chartH;
            var y = padding.top + chartH - barH;

            // Bar gradient
            var gradient = ctx.createLinearGradient(x, y, x, padding.top + chartH);

            if (day.calories > goals.calories) {
                gradient.addColorStop(0, 'rgba(239, 68, 68, 0.9)');
                gradient.addColorStop(1, 'rgba(239, 68, 68, 0.3)');
            } else if (day.isToday) {
                gradient.addColorStop(0, 'rgba(99, 102, 241, 0.9)');
                gradient.addColorStop(1, 'rgba(99, 102, 241, 0.3)');
            } else {
                gradient.addColorStop(0, 'rgba(129, 140, 248, 0.6)');
                gradient.addColorStop(1, 'rgba(129, 140, 248, 0.15)');
            }

            ctx.fillStyle = gradient;

            // Rounded top bar
            var radius = Math.min(6, barWidth / 2);
            if (barH > 0) {
                ctx.beginPath();
                ctx.moveTo(x, padding.top + chartH);
                ctx.lineTo(x, y + radius);
                ctx.quadraticCurveTo(x, y, x + radius, y);
                ctx.lineTo(x + barWidth - radius, y);
                ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
                ctx.lineTo(x + barWidth, padding.top + chartH);
                ctx.closePath();
                ctx.fill();
            }

            // Glow for today
            if (day.isToday && barH > 0) {
                ctx.shadowColor = 'rgba(99, 102, 241, 0.4)';
                ctx.shadowBlur = 12;
                ctx.fill();
                ctx.shadowBlur = 0;
            }

            // Value on top of bar
            if (day.calories > 0) {
                ctx.fillStyle = day.isToday ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.5)';
                ctx.font = (day.isToday ? '600 ' : '') + '10px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(Math.round(day.calories), x + barWidth / 2, y - 6);
            }

            // Day labels
            ctx.fillStyle = day.isToday ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.35)';
            ctx.font = (day.isToday ? '600 ' : '') + '11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(day.label, x + barWidth / 2, height - padding.bottom + 18);

            // Today dot
            if (day.isToday) {
                ctx.beginPath();
                ctx.arc(x + barWidth / 2, height - padding.bottom + 28, 2.5, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(99, 102, 241, 0.8)';
                ctx.fill();
            }
        });
    }

    // ========================
    // SVG Gradient for Ring
    // ========================
    function injectRingSVGGradient() {
        var svg = document.querySelector('.progress-ring');
        if (!svg) return;
        var defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

        var gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        gradient.setAttribute('id', 'ringGradient');
        gradient.setAttribute('x1', '0%');
        gradient.setAttribute('y1', '0%');
        gradient.setAttribute('x2', '100%');
        gradient.setAttribute('y2', '100%');

        var stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop1.setAttribute('offset', '0%');
        stop1.setAttribute('stop-color', '#6366f1');

        var stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop2.setAttribute('offset', '50%');
        stop2.setAttribute('stop-color', '#8b5cf6');

        var stop3 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop3.setAttribute('offset', '100%');
        stop3.setAttribute('stop-color', '#a78bfa');

        gradient.appendChild(stop1);
        gradient.appendChild(stop2);
        gradient.appendChild(stop3);
        defs.appendChild(gradient);
        svg.insertBefore(defs, svg.firstChild);
    }

    // ========================
    // Toast Notifications
    // ========================
    function showToast(message, type) {
        type = type || 'success';
        var toast = document.createElement('div');
        toast.classList.add('toast', 'toast-' + type);

        // Icon
        var iconSvgStr = type === 'success'
            ? '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
            : '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';

        var iconWrapper = document.createElement('span');
        iconWrapper.classList.add('toast-icon');
        var parser = new DOMParser();
        var iconDoc = parser.parseFromString(iconSvgStr, 'image/svg+xml');
        iconWrapper.appendChild(iconDoc.documentElement);
        toast.appendChild(iconWrapper);

        var textNode = document.createElement('span');
        textNode.textContent = message;
        toast.appendChild(textNode);

        dom.toastContainer.appendChild(toast);

        setTimeout(function () {
            toast.classList.add('toast-exit');
            toast.addEventListener('animationend', function () {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            });
        }, 2500);
    }

    // ========================
    // Modal Helpers
    // ========================
    function openModal(overlay) {
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        // Focus trap: focus first input or close button
        var focusable = overlay.querySelector('input, button, select, textarea');
        if (focusable) focusable.focus();
    }

    function closeModal(overlay) {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    function showConfirm(message, callback) {
        dom.confirmMessage.textContent = message;
        confirmCallback = callback;
        openModal(dom.confirmModal);
    }

    // ========================
    // Event Handlers
    // ========================
    function handleAddFood(e) {
        e.preventDefault();

        var name = sanitizeText(dom.foodName.value, 100);
        var calories = sanitizeNumber(dom.foodCalories.value, 0, 10000, 0);
        var protein = sanitizeNumber(dom.foodProtein.value, 0, 1000, 0);
        var carbs = sanitizeNumber(dom.foodCarbs.value, 0, 1000, 0);
        var fat = sanitizeNumber(dom.foodFat.value, 0, 1000, 0);
        var meal = dom.foodMeal.value;

        if (!name) {
            showToast('Please enter a food name', 'error');
            dom.foodName.focus();
            return;
        }

        if (calories <= 0) {
            showToast('Please enter valid calories', 'error');
            dom.foodCalories.focus();
            return;
        }

        if (!isValidMeal(meal)) {
            showToast('Please select a valid meal', 'error');
            return;
        }

        var entry = {
            id: generateId(),
            name: name,
            calories: calories,
            protein: protein,
            carbs: carbs,
            fat: fat,
            meal: meal,
            timestamp: Date.now(),
        };

        addEntry(currentDate, entry);

        // Reset form
        dom.addFoodForm.reset();
        dom.foodName.focus();

        refreshUI();
        showToast(name + ' added!', 'success');
    }

    function handleDatePrev() {
        currentDate = shiftDate(currentDate, -1);
        activeFilter = 'all';
        setActiveFilterTab('all');
        refreshUI();
    }

    function handleDateNext() {
        currentDate = shiftDate(currentDate, 1);
        activeFilter = 'all';
        setActiveFilterTab('all');
        refreshUI();
    }

    function handleDatePick() {
        dom.datePicker.showPicker();
    }

    function handleDateChange(e) {
        var val = e.target.value;
        if (isValidDateString(val)) {
            currentDate = val;
            activeFilter = 'all';
            setActiveFilterTab('all');
            refreshUI();
        }
    }

    function handleFilterClick(e) {
        var tab = e.target.closest('.filter-tab');
        if (!tab) return;
        var filter = tab.dataset.filter;
        if (!filter) return;
        activeFilter = filter;
        setActiveFilterTab(filter);
        renderFoodLog();
    }

    function setActiveFilterTab(filter) {
        var tabs = dom.filterTabs.querySelectorAll('.filter-tab');
        tabs.forEach(function (t) {
            var isActive = t.dataset.filter === filter;
            t.classList.toggle('active', isActive);
            t.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
    }

    function handleOpenSettings() {
        var goals = loadGoals();
        dom.goalCalories.value = goals.calories;
        dom.goalProtein.value = goals.protein;
        dom.goalCarbs.value = goals.carbs;
        dom.goalFat.value = goals.fat;
        openModal(dom.settingsModal);
    }

    function handleSaveSettings(e) {
        e.preventDefault();
        var goals = {
            calories: sanitizeNumber(dom.goalCalories.value, 500, 10000, DEFAULT_GOALS.calories),
            protein: sanitizeNumber(dom.goalProtein.value, 0, 500, DEFAULT_GOALS.protein),
            carbs: sanitizeNumber(dom.goalCarbs.value, 0, 1000, DEFAULT_GOALS.carbs),
            fat: sanitizeNumber(dom.goalFat.value, 0, 500, DEFAULT_GOALS.fat),
        };
        saveGoals(goals);
        closeModal(dom.settingsModal);
        refreshUI();
        showToast('Goals saved!', 'success');
    }

    function handleClearToday() {
        showConfirm(
            'Are you sure you want to clear all entries for ' + formatDateDisplay(currentDate) + '?',
            function () {
                clearEntriesForDate(currentDate);
                refreshUI();
                showToast("Today's log cleared", 'success');
                closeModal(dom.settingsModal);
            }
        );
    }

    function handleClearAll() {
        showConfirm(
            'This will permanently delete ALL your food entries across all dates. This action cannot be undone.',
            function () {
                clearAllEntries();
                refreshUI();
                showToast('All data cleared', 'success');
                closeModal(dom.settingsModal);
            }
        );
    }

    function handleConfirmOk() {
        closeModal(dom.confirmModal);
        if (typeof confirmCallback === 'function') {
            confirmCallback();
            confirmCallback = null;
        }
    }

    function handleConfirmCancel() {
        closeModal(dom.confirmModal);
        confirmCallback = null;
    }

    // Close modals on overlay click
    function handleOverlayClick(e) {
        if (e.target === dom.settingsModal) {
            closeModal(dom.settingsModal);
        }
        if (e.target === dom.confirmModal) {
            closeModal(dom.confirmModal);
            confirmCallback = null;
        }
    }

    // Escape key closes modals
    function handleKeyDown(e) {
        if (e.key === 'Escape') {
            if (dom.confirmModal.classList.contains('active')) {
                closeModal(dom.confirmModal);
                confirmCallback = null;
            } else if (dom.settingsModal.classList.contains('active')) {
                closeModal(dom.settingsModal);
            }
        }
    }

    // ========================
    // Event Binding
    // ========================
    function bindEvents() {
        dom.addFoodForm.addEventListener('submit', handleAddFood);
        dom.datePrevBtn.addEventListener('click', handleDatePrev);
        dom.dateNextBtn.addEventListener('click', handleDateNext);
        dom.dateDisplayBtn.addEventListener('click', handleDatePick);
        dom.datePicker.addEventListener('change', handleDateChange);
        dom.filterTabs.addEventListener('click', handleFilterClick);
        dom.settingsBtn.addEventListener('click', handleOpenSettings);
        dom.settingsCloseBtn.addEventListener('click', function () { closeModal(dom.settingsModal); });
        dom.settingsForm.addEventListener('submit', handleSaveSettings);
        dom.clearTodayBtn.addEventListener('click', handleClearToday);
        dom.clearAllBtn.addEventListener('click', handleClearAll);
        dom.confirmOkBtn.addEventListener('click', handleConfirmOk);
        dom.confirmCancelBtn.addEventListener('click', handleConfirmCancel);
        dom.settingsModal.addEventListener('click', handleOverlayClick);
        dom.confirmModal.addEventListener('click', handleOverlayClick);
        document.addEventListener('keydown', handleKeyDown);

        // Redraw chart on resize
        var resizeTimer;
        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(drawWeeklyChart, 200);
        });
    }

    // ========================
    // Initialize
    // ========================
    function init() {
        injectRingSVGGradient();
        bindEvents();
        refreshUI();
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
