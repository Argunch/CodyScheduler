/**
 * Модалка учеников с проблемами баланса (для суперюзера).
 * Показывает кнопку с восклицательным знаком, если есть
 * хотя бы один ученик с нулевым или отрицательным балансом.
 */
export class AdminBalanceModal {
    constructor() {
        this.modal = document.getElementById('admin-balance-modal');
        this.list = document.getElementById('admin-balance-list');
        this.closeBtn = document.getElementById('admin-balance-close');
        this.btn = document.getElementById('admin-balance-btn');
        this.countEl = document.getElementById('admin-balance-count');

        this.zero = [];
        this.negative = [];
        this.compensations = [];   // ДОБАВЛЕНО

        this.bindEvents();
    }

    bindEvents() {
        if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());
        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) this.close();
            });
        }
        if (this.btn) {
            this.btn.addEventListener('click', () => this.open());
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) this.close();
        });
    }

    isOpen() {
        return this.modal && this.modal.classList.contains('active');
    }

    async checkAndShowBtn() {
        try {
            const response = await fetch('/api/load-problem-students/', {
                cache: 'no-store',
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            const data = await response.json();

            if (data.status !== 'success') return;

            this.zero = data.zero || [];
            this.negative = data.negative || [];
            this.compensations = data.compensations || [];   // ДОБАВЛЕНО
            const total = this.zero.length + this.negative.length + this.compensations.length;   // ИЗМЕНЕНО

            if (total === 0) {
                if (this.btn) this.btn.style.display = 'none';
            } else {
                if (this.btn) {
                    this.btn.style.display = 'inline-flex';
                    if (this.countEl) this.countEl.textContent = total;
                }
            }
        } catch (error) {
            console.error('❌ Ошибка checkAndShowBtn (balance):', error);
        }
    }

    async open() {
        await this.checkAndShowBtn();
        this.render();
        if (this.modal) this.modal.classList.add('active');
    }

    close() {
        if (this.modal) this.modal.classList.remove('active');
    }

    render() {
        if (!this.list) return;

        if (this.zero.length === 0 && this.negative.length === 0) {
            this.list.innerHTML = '<div class="admin-unmarked-empty">Все ученики с положительным балансом 👍</div>';
            return;
        }

        const parts = [];

        if (this.negative.length > 0) {
            parts.push(`
                <div class="admin-balance-section">
                    <div class="admin-balance-section-title negative-title">
                        Отрицательный баланс (${this.negative.length})
                    </div>
                    ${this.negative.map(s => this.renderRow(s, 'negative')).join('')}
                </div>
            `);
        }

        if (this.zero.length > 0) {
            parts.push(`
                <div class="admin-balance-section">
                    <div class="admin-balance-section-title zero-title">
                        Нулевой баланс (${this.zero.length})
                    </div>
                    ${this.zero.map(s => this.renderRow(s, 'zero')).join('')}
                </div>
            `);
        }

        // ДОБАВЛЕНО: раздел компенсаций
         if (this.compensations.length > 0) {
            parts.push(`
                <div class="admin-compensation-section">
                    <div class="admin-compensation-title">
                        Компенсация (${this.compensations.length})
                    </div>
                    <div class="admin-compensation-list">
                        ${this.compensations.map(c => this.renderCompensationRow(c)).join('')}
                    </div>
                </div>
            `);
        }

        this.list.innerHTML = parts.join('');
        // ИЗМЕНЕНО: блок с чекбоксами и кнопкой "Отметить" удалён

        // ДОБАВЛЕНО: обработчики чекбоксов компенсаций
        const checkboxes = this.list.querySelectorAll('.admin-compensation-row input[type="checkbox"]');
        const applyBtn = document.getElementById('admin-compensation-apply');
        if (applyBtn) {
            checkboxes.forEach(cb => {
                cb.addEventListener('change', () => {
                    const anyChecked = Array.from(checkboxes).some(c => c.checked);
                    applyBtn.disabled = !anyChecked;
                });
            });
            applyBtn.addEventListener('click', () => this.applyCompensations());
        }
    }

    renderCompensationRow(c) {
        // ИЗМЕНЕНО: без чекбокса, только информация
        const dateLabel = c.date ? this.formatDate(c.date) : '';
        const parts = [];
        if (c.course_name) parts.push(c.course_name);
        if (dateLabel) parts.push(dateLabel);
        if (c.time) parts.push(c.time);
        const meta = parts.join(' · ');

        return `
            <div class="admin-compensation-row" data-id="${c.attendance_id || c.student_id}">
                <div class="admin-compensation-info">
                    <span class="admin-compensation-name">${this.escapeHtml(c.student_name)}</span>
                    <span class="admin-compensation-meta">${this.escapeHtml(meta)}</span>
                </div>
            </div>
        `;
    }

    async applyCompensations() {
        const checkboxes = this.list.querySelectorAll('.admin-compensation-row input[type="checkbox"]:checked');
        const ids = Array.from(checkboxes).map(cb => parseInt(cb.value, 10));
        if (ids.length === 0) return;

        const btn = document.getElementById('admin-compensation-apply');
        if (btn) { btn.disabled = true; btn.textContent = 'Сохранение...'; }

        try {
            const response = await fetch('/api/mark-compensated/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({ ids })
            });
            const data = await response.json();
            console.log('📥 mark-compensated:', data);

            if (data.status === 'success') {
                // Убираем отмеченные из локального массива и перерисовываем
                this.compensations = this.compensations.filter(c => !ids.includes(c.attendance_id));
                this.render();
                // Обновляем счётчик
                const total = this.zero.length + this.negative.length + this.compensations.length;
                if (this.countEl) this.countEl.textContent = total;
                if (total === 0 && this.btn) this.btn.style.display = 'none';
            } else {
                alert('Ошибка: ' + (data.message || 'не удалось сохранить'));
            }
        } catch (error) {
            console.error('❌ Ошибка mark-compensated:', error);
            alert('Ошибка сети');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Отметить'; }
        }
    }

    formatDate(iso) {
        const [y, m, d] = iso.split('-');
        return `${d}.${m}.${y}`;
    }

    renderRow(student, type) {
        const amountText = student.balance === 0
            ? '0 ₽'
            : `${student.balance} ₽`;

        return `
            <a class="admin-balance-row" href="/students/${student.id}/">
                <span class="admin-balance-name">${this.escapeHtml(student.full_name)}</span>
                <span class="admin-balance-amount ${type}">${amountText}</span>
            </a>
        `;
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