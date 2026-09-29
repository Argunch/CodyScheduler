/**
 * Модалка со всеми неотмеченными занятиями (для суперюзера).
 * Показывает колокольчик, если есть хоть одно неотмеченное занятие.
 * Отметка — та же логика, что в CompletionModal, но с группировкой по преподавателю.
 */
export class AdminUnmarkedModal {
    constructor() {
        this.modal = document.getElementById('admin-unmarked-modal');
        this.list = document.getElementById('admin-unmarked-list');
        this.closeBtn = document.getElementById('admin-unmarked-close');
        this.bell = document.getElementById('admin-notifications-btn');
        this.countEl = document.getElementById('admin-notifications-count');

        this.events = [];
        this.teacherMap = {};   // {teacher_id: teacher_name}

        this.bindEvents();
    }

    bindEvents() {
        if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());
        if (this.modal) {
            // Клик по затемнению (вне окна .admin-unmarked-window)
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) this.close();
            });
        }
        if (this.bell) {
            this.bell.addEventListener('click', () => this.open());
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) this.close();
        });

        // ДОБАВЛЕНО: реагируем на изменения списка неотмеченных
        document.addEventListener('unmarkedEventsChanged', () => {
            this.checkAndShowBell();
        });
    }

    isOpen() {
        return this.modal && this.modal.classList.contains('active');
    }

    async checkAndShowBell() {
        try {
            const response = await fetch('/api/load-all-unmarked-events/', {
                cache: 'no-store',
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            const data = await response.json();

            if (data.status !== 'success') return;

            this.events = data.events || [];

            if (this.events.length === 0) {
                if (this.bell) this.bell.style.display = 'none';
            } else {
                if (this.bell) {
                    this.bell.style.display = 'inline-flex';
                    if (this.countEl) this.countEl.textContent = this.events.length;
                }
            }
        } catch (error) {
            console.error('❌ Ошибка checkAndShowBell:', error);
        }
    }

    async open() {
        // Перезагружаем список перед открытием — чтобы были свежие данные
        await this.checkAndShowBell();

        this.render();
        if (this.modal) this.modal.classList.add('active');
    }

    close() {
        if (this.modal) this.modal.classList.remove('active');
    }

    render() {
        if (!this.list) return;

        if (this.events.length === 0) {
            this.list.innerHTML = '<div class="admin-unmarked-empty">Все занятия отмечены 👍</div>';
            return;
        }

        // Группируем по teacher_id
        const grouped = {};
        for (const ev of this.events) {
            const key = ev.teacher_id;
            if (!grouped[key]) {
                grouped[key] = { teacher_name: ev.teacher_name, events: [] };
            }
            grouped[key].events.push(ev);
        }

        this.list.innerHTML = Object.entries(grouped).map(([teacherId, group]) => {
            const cards = group.events.map(ev => this.renderCard(ev)).join('');
            return `
                <div class="admin-unmarked-teacher-group" data-teacher-id="${teacherId}">
                    <div class="admin-unmarked-teacher-name">${this.escapeHtml(group.teacher_name)}</div>
                    ${cards}
                </div>
            `;
        }).join('');

        // Навешиваем обработчики на карточки
        this.list.querySelectorAll('.completion-card').forEach(card => {
            this.bindCardEvents(card);
        });
    }

    renderCard(ev) {
        const timeLabel = this.formatDateTime(ev.date, ev.time);

        if (ev.status === 'group') {
            const studentRows = (ev.students || []).map(s => {
                const checked = s.was_present === true ? 'checked' : '';
                const suffix = (s.remaining_lessons !== null && s.remaining_lessons !== undefined)
                    ? ` (${s.remaining_lessons})` : '';
                return `
                    <div class="completion-student-row">
                        <input type="checkbox" value="${s.id}" ${checked}>
                        <span class="completion-student-name">${this.escapeHtml(s.full_name)}${suffix}</span>
                    </div>
                `;
            }).join('');

            return `
                <div class="completion-card" data-id="${ev.id}" data-status="group">
                    <div class="completion-card-header">
                        <div class="completion-card-title">${this.escapeHtml(ev.course_name || ev.text)}</div>
                        <div class="completion-card-time">${timeLabel}</div>
                    </div>
                    <div class="completion-students">${studentRows}</div>
                    <div class="completion-card-actions">
                        <button class="completion-mark-btn">Отметить</button>
                    </div>
                </div>
            `;
        }

        // Individual
        const studentName = (ev.students && ev.students.length > 0)
            ? ev.students.map(s => {
                const suffix = (s.remaining_lessons !== null && s.remaining_lessons !== undefined)
                    ? ` (${s.remaining_lessons})` : '';
                return s.full_name + suffix;
            }).join(', ')
            : 'Без ученика';

        return `
            <div class="completion-card" data-id="${ev.id}" data-status="individual">
                <div class="completion-card-header">
                    <div class="completion-card-title">${this.escapeHtml(ev.course_name || ev.text)}</div>
                    <div class="completion-card-time">${timeLabel}</div>
                </div>
                <div class="completion-card-student">${this.escapeHtml(studentName)}</div>
                <div class="completion-card-status">
                    <select class="completion-status-select">
                        <option value="">— Выберите статус —</option>
                        <option value="passed">Прошло успешно</option>
                        <option value="missed_student">Пропущено учеником</option>
                        <option value="missed_teacher">Пропущено преподавателем</option>
                        <option value="not_conducted">Не проведено</option>
                    </select>
                    <button class="completion-mark-btn" disabled>Отметить</button>
                </div>
            </div>
        `;
    }

    bindCardEvents(card) {
        const type = card.dataset.status;

        if (type === 'group') {
            const btn = card.querySelector('.completion-mark-btn');
            btn.addEventListener('click', () => {
                const eventId = parseInt(card.dataset.id, 10);
                const attendances = Array.from(
                    card.querySelectorAll('.completion-students input[type="checkbox"]')
                ).map(cb => ({
                    student_id: parseInt(cb.value, 10),
                    was_present: cb.checked
                }));
                this.markEvent(card, eventId, null, attendances);
            });
        } else {
            const select = card.querySelector('.completion-status-select');
            const btn = card.querySelector('.completion-mark-btn');

            select.addEventListener('change', () => {
                btn.disabled = !select.value;
            });

            btn.addEventListener('click', () => {
                const eventId = parseInt(card.dataset.id, 10);
                this.markEvent(card, eventId, select.value);
            });
        }
    }

    async markEvent(card, eventId, completionStatus, attendances = null) {
        const btn = card.querySelector('.completion-mark-btn');
        const select = card.querySelector('.completion-status-select');

        if (select) select.disabled = true;
        btn.disabled = true;
        btn.textContent = 'Отправка...';

        const payload = { id: eventId };
        if (completionStatus) payload.completion_status = completionStatus;
        if (attendances) payload.attendances = attendances;

        try {
            const response = await fetch('/api/mark-event/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            console.log('📥 mark-event:', data);

            if (data.status === 'success') {
                card.remove();
                this.events = this.events.filter(e => e.id !== eventId);

                if (this.countEl) this.countEl.textContent = this.events.length;

                if (this.events.length === 0) {
                    if (this.bell) this.bell.style.display = 'none';
                    this.render();
                }
            } else {
                alert('Ошибка: ' + (data.message || 'не удалось сохранить'));
                if (select) select.disabled = false;
                btn.disabled = false;
                btn.textContent = 'Отметить';
            }
        } catch (error) {
            console.error('❌ Ошибка mark-event:', error);
            alert('Ошибка сети');
            if (select) select.disabled = false;
            btn.disabled = false;
            btn.textContent = 'Отметить';
        }
    }

    formatDateTime(date, time) {
        const [y, m, d] = date.split('-');
        return `${d}.${m}, ${time}`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getCsrfToken() {
        const name = 'csrftoken';
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
            const trimmed = cookie.trim();
            if (trimmed.startsWith(name + '=')) {
                return decodeURIComponent(trimmed.substring(name.length + 1));
            }
        }
        return '';
    }
}