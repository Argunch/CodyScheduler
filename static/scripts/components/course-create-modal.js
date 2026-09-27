/**
 * Модалка создания нового курса.
 * Открывается поверх модалки стоимости курса.
 * После создания возвращает объект {id, name} через callback.
 */
export class CourseCreateModal {
    constructor() {
        this.modal = document.getElementById('course-create-modal');
        this.overlay = document.getElementById('course-create-overlay');
        this.closeBtn = document.getElementById('course-create-close');
        this.cancelBtn = document.getElementById('course-create-cancel');
        this.saveBtn = document.getElementById('course-create-save');
        this.nameInput = document.getElementById('course-create-name');
        this.errorBox = document.getElementById('course-create-error');

        this.onCreated = null;   // callback, устанавливается при open()

        this.bindEvents();
    }

    bindEvents() {
        if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());
        if (this.cancelBtn) this.cancelBtn.addEventListener('click', () => this.close());
        if (this.overlay) this.overlay.addEventListener('click', () => this.close());
        if (this.saveBtn) this.saveBtn.addEventListener('click', () => this.handleSave());

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) {
                e.stopPropagation();   // не закрываем модалку цены
                this.close();
            }
        }, true);
    }

    isOpen() {
        return this.modal && this.modal.classList.contains('active');
    }

    open(onCreated) {
        this.onCreated = onCreated || null;
        this.nameInput.value = '';
        this.hideError();
        if (this.modal) this.modal.classList.add('active');
        if (this.overlay) this.overlay.classList.add('active');
        setTimeout(() => this.nameInput?.focus(), 100);
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

    async handleSave() {
        const name = this.nameInput.value.trim();
        if (!name) {
            this.showError('Введите название курса');
            return;
        }

        this.saveBtn.disabled = true;
        this.saveBtn.textContent = 'Создание...';
        this.hideError();

        try {
            const response = await fetch('/api/create-course/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({ name })
            });
            const data = await response.json();
            console.log('📥 Ответ create-course:', data);

            if (data.status === 'success') {
                const created = { id: data.id, name: data.name };
                this.close();
                if (this.onCreated) this.onCreated(created);
            } else {
                this.showError(data.message || 'Не удалось создать курс');
            }
        } catch (error) {
            console.error('❌ Ошибка create-course:', error);
            this.showError('Ошибка сети');
        } finally {
            this.saveBtn.disabled = false;
            this.saveBtn.textContent = 'Создать';
        }
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
export function getCourseCreateModal() {
    if (!_instance) _instance = new CourseCreateModal();
    return _instance;
}