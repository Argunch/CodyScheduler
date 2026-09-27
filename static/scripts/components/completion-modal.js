/**
 * Модалка отметки прошедших индивидуальных занятий.
 * Открывается, если есть непроверенные занятия за последние 7 дней.
 * Закрыть нельзя — только отметить все.
 */
export class CompletionModal {
    constructor() {
        this.modal = document.getElementById('completion-modal');
        this.list = document.getElementById('completion-list');
        this.events = [];

        // Блокируем Esc, пока модалка открыта
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, true);   // capture=true — перехватываем раньше других обработчиков
    }

    isOpen() {
        return this.modal && this.modal.classList.contains('active');
    }

    /**
     * Загружает непроверенные занятия и, если есть, показывает модалку
     */
    async checkAndShow() {
        try {
            const response = await fetch('/api/load-unmarked-events/', {
                cache: 'no-store',
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            const data = await response.json();

            if (data.status !== 'success') {
                console.warn('⚠️ load-unmarked-events вернул ошибку:', data.message);
                return;
            }
            if (!data.events || data.events.length === 0) {
                return;   // нечего отмечать
            }

            this.events = data.events;
            this.render();
            this.open();
        } catch (error) {
            console.error('❌ Ошибка загрузки непроверенных занятий:', error);
        }
    }

    render() {
        if (!this.list) return;

        this.list.innerHTML = this.events.map(ev => {
            const timeLabel = this.formatDateTime(ev.date, ev.time);

            if (ev.status === 'group') {
                // ─── ГРУППОВОЕ ──────────────────────
                const studentRows = (ev.students || []).map(s => {
                    const checked = s.was_present === true ? 'checked' : '';
                    // ДОБАВЛЕНО: суффикс с остатком
                    const suffix = (s.remaining_lessons !== null && s.remaining_lessons !== undefined)
                        ? ` (${s.remaining_lessons})`
                        : '';
                    return `
                        <div class="completion-student-row">
                            <input type="checkbox" value="${s.id}" ${checked}>
                            <span class="completion-student-name" data-student-id="${s.id}">${this.escapeHtml(s.full_name)}${suffix}</span>
                        </div>
                    `;
                }).join('');
                return `
                    <div class="completion-card" data-id="${ev.id}" data-status="group">
                        <div class="completion-card-header">
                            <div class="completion-card-title">${this.escapeHtml(ev.text)}</div>
                            <div class="completion-card-time">${timeLabel}</div>
                        </div>
                        <div class="completion-students">
                            ${studentRows}
                        </div>
                        <div class="completion-card-actions">
                            <button class="completion-mark-btn">Отметить</button>
                        </div>
                    </div>
                `;
            }

            // ИЗМЕНЕНО: добавляем (N) к имени ученика
            const studentName = (ev.students && ev.students.length > 0)
                ? ev.students.map(s => {
                    const suffix = (s.remaining_lessons !== null && s.remaining_lessons !== undefined)
                        ? ` (${s.remaining_lessons})`
                        : '';
                    return s.full_name + suffix;
                }).join(', ')
                : 'Без ученика';
            return `
                <div class="completion-card" data-id="${ev.id}" data-status="individual">
                    <div class="completion-card-header">
                        <div class="completion-card-title">${this.escapeHtml(ev.text)}</div>
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
        }).join('');

        // Обработчики на карточках
        this.list.querySelectorAll('.completion-card').forEach(card => {
            const type = card.dataset.status;

            if (type === 'group') {
                // Групповое: кнопка всегда активна, данные берём из чекбоксов
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
                // Индивидуальное: как было
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
        });
    }

    /**
     * Отправляет отметку на сервер.
     * Для индивидуальных: completionStatus обязателен.
     * Для групповых: attendances — массив {student_id, was_present}.
     */
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
            console.log('📥 Ответ mark-event:', data);

            if (data.status === 'success') {
                card.remove();
                this.events = this.events.filter(e => e.id !== eventId);

                if (this.events.length === 0) {
                    this.close();
                    console.log('✅ Все занятия отмечены, модалка закрыта');
                }
            } else {
                alert('Ошибка: ' + (data.message || 'не удалось сохранить'));
                if (select) select.disabled = false;
                btn.disabled = false;
                btn.textContent = 'Отметить';
            }
        } catch (error) {
            console.error('❌ Ошибка отправки:', error);
            alert('Ошибка сети при сохранении');
            if (select) select.disabled = false;
            btn.disabled = false;
            btn.textContent = 'Отметить';
        }
    }

    open() {
        if (this.modal) this.modal.classList.add('active');
    }

    close() {
        if (this.modal) this.modal.classList.remove('active');
    }

    /* ==================== УТИЛИТЫ ==================== */

    formatDateTime(date, time) {
        // date: "2026-09-22", time: "10:00"
        const [y, m, d] = date.split('-');
        return `${d}.${m}, ${time}`;
    }

    getCsrfToken() {
        const name = 'csrftoken';
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            cookie = cookie.trim();
            if (cookie.startsWith(name + '=')) {
                return decodeURIComponent(cookie.substring(name.length + 1));
            }
        }
        return '';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}