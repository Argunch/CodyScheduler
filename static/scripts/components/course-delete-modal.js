/**
 * Модалка удаления курса.
 * Открывается поверх модалки стоимости курса.
 * После успешного удаления сообщает родителю через callback.
 */
export class CourseDeleteModal {
    constructor() {
        this.modal = document.getElementById('course-delete-modal');
        this.overlay = document.getElementById('course-delete-overlay');
        this.closeBtn = document.getElementById('course-delete-close');
        this.cancelBtn = document.getElementById('course-delete-cancel');
        
        this.archiveBtn = document.getElementById('course-delete-archive');   // ДОБАВЛЕНО
        this.hardBtn = document.getElementById('course-delete-hard');         // ИЗМЕНЕНО: было confirmBtn

        this.select = document.getElementById('course-delete-select');
        this.errorBox = document.getElementById('course-delete-error');

        this.onDeleted = null;
        this.bindEvents();
    }

    bindEvents() {
        if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());
        if (this.cancelBtn) this.cancelBtn.addEventListener('click', () => this.close());
        if (this.overlay) this.overlay.addEventListener('click', () => this.close());
        if (this.archiveBtn) this.archiveBtn.addEventListener('click', () => this.handleAction('archive'));
        if (this.hardBtn) this.hardBtn.addEventListener('click', () => this.handleAction('hard'));

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) {
                e.stopPropagation();
                this.close();
            }
        }, true);
    }

    isOpen() {
        return this.modal && this.modal.classList.contains('active');
    }

    /**
     * @param {Array} courses — список курсов для dropdown
     * @param {Function} onDeleted — callback(deletedCourse) после успеха
     */
    open(courses, onDeleted) {
        this.onDeleted = onDeleted || null;
        this.hideError();

        if (this.select) {
            this.select.innerHTML = '<option value="" disabled selected>— Выберите курс —</option>' +
                courses.map(c => `<option value="${c.id}">${this.escapeHtml(c.name)}</option>`).join('');
        }

        if (this.modal) this.modal.classList.add('active');
        if (this.overlay) this.overlay.classList.add('active');
    }

    close() {
        if (this.modal) this.modal.classList.remove('active');
        if (this.overlay) this.overlay.classList.remove('active');
    }

    showError(message) {
        if (!this.errorBox) return;
        this.errorBox.textContent = message;
        this.errorBox.style.display = 'block';
    }

    hideError() {
        if (!this.errorBox) return;
        this.errorBox.textContent = '';
        this.errorBox.style.display = 'none';
    }



    // НОВЫЙ МЕТОД: единая точка отправки с выбором режима
    async handleAction(mode) {
        const id = parseInt(this.select.value, 10);
        if (!id) {
            this.showError('Выберите курс');
            return;
        }

        const selectedName = this.select.options[this.select.selectedIndex].textContent;

        // ИЗМЕНЕНО: разные подтверждения для разных режимов
        if (mode === 'archive') {
            if (!confirm(`Отправить курс «${selectedName}» в архив?\nКурс скроется из списков, но история операций сохранится.`)) {
                return;
            }
        } else {
            if (!confirm(`УДАЛИТЬ курс «${selectedName}» безвозвратно?\nВсе связанные данные (платежи, списания, привязки к занятиям) будут потеряны.`)) {
                return;
            }
        }

        // ИЗМЕНЕНО: блокируем обе кнопки
        this.archiveBtn.disabled = true;
        this.hardBtn.disabled = true;
        const btn = (mode === 'archive') ? this.archiveBtn : this.hardBtn;
        const originalText = btn.textContent;
        btn.textContent = 'Обработка...';
        this.hideError();

        try {
            const response = await fetch('/api/delete-course/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                // ИЗМЕНЕНО: передаём mode
                body: JSON.stringify({ id, mode })
            });
            const data = await response.json();
            console.log('📥 Ответ delete-course:', data);

            if (data.status === 'success') {
                this.close();
                if (this.onDeleted) this.onDeleted(id, mode);   // ИЗМЕНЕНО: второй аргумент
            } else {
                this.showError(data.message || 'Не удалось удалить курс');
            }
        } catch (error) {
            console.error('❌ Ошибка delete-course:', error);
            this.showError('Ошибка сети');
        } finally {
            // ИЗМЕНЕНО: разблокируем всё
            this.archiveBtn.disabled = false;
            this.hardBtn.disabled = false;
            btn.textContent = originalText;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
}

// ДОБАВЛЕНО: singleton
let _instance = null;
export function getCourseDeleteModal() {
    if (!_instance) _instance = new CourseDeleteModal();
    return _instance;
}