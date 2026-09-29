/**
 * Модалка дополнительной информации об ученике.
 */
export class StudentExtraModal {
    constructor(studentId) {
        this.studentId = studentId;

        this.modal = document.getElementById('student-extra-modal');
        this.overlay = document.getElementById('student-extra-overlay');
        this.closeBtn = document.getElementById('student-extra-close');
        this.cancelBtn = document.getElementById('student-extra-cancel');
        this.saveBtn = document.getElementById('student-extra-save');

        this.inputBirthDate = document.getElementById('extra-birth-date');
        this.inputParentName = document.getElementById('extra-parent-name');
        this.inputParentPhone = document.getElementById('extra-parent-phone');
        this.inputExtraInfo = document.getElementById('extra-info');

        this.bindEvents();
    }

    bindEvents() {
        if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());
        if (this.cancelBtn) this.cancelBtn.addEventListener('click', () => this.close());
        if (this.overlay) this.overlay.addEventListener('click', () => this.close());
        if (this.saveBtn) this.saveBtn.addEventListener('click', () => this.handleSave());

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) this.close();
        });
    }

    isOpen() {
        return this.modal && this.modal.classList.contains('active');
    }

    async open() {
        await this.loadData();
        if (this.modal) this.modal.classList.add('active');
        if (this.overlay) this.overlay.classList.add('active');
    }

    close() {
        if (this.modal) this.modal.classList.remove('active');
        if (this.overlay) this.overlay.classList.remove('active');
    }

    async loadData() {
        try {
            const response = await fetch(
                `/api/load-student-extra/?student_id=${this.studentId}`,
                { cache: 'no-store', headers: { 'X-Requested-With': 'XMLHttpRequest' } }
            );
            const data = await response.json();

            if (data.status === 'success') {
                this.inputBirthDate.value = data.birth_date || '';
                this.inputParentName.value = data.parent_name || '';
                this.inputParentPhone.value = data.parent_phone || '';
                this.inputExtraInfo.value = data.extra_info || '';
            } else {
                console.error('Ошибка загрузки доп. информации:', data.message);
            }
        } catch (error) {
            console.error('❌ Ошибка load-student-extra:', error);
        }
    }

    async handleSave() {
        this.saveBtn.disabled = true;
        this.saveBtn.textContent = 'Сохранение...';

        const payload = {
            student_id: this.studentId,
            birth_date: this.inputBirthDate.value || '',
            parent_name: this.inputParentName.value.trim(),
            parent_phone: this.inputParentPhone.value.trim(),
            extra_info: this.inputExtraInfo.value,
        };

        try {
            const response = await fetch('/api/save-student-extra/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            console.log('📥 Ответ save-student-extra:', data);

            if (data.status === 'success') {
                this.close();
            } else {
                alert('Ошибка: ' + (data.message || 'не удалось сохранить'));
            }
        } catch (error) {
            console.error('❌ Ошибка save-student-extra:', error);
            alert('Ошибка сети при сохранении');
        } finally {
            this.saveBtn.disabled = false;
            this.saveBtn.textContent = 'Сохранить';
        }
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