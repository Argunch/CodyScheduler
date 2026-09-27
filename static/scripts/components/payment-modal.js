/**
 * Модалка добавления оплаты.
 * Пока без сохранения — только открытие/закрытие и загрузка курсов.
 */
export class PaymentModal {
    constructor() {
        this.modal = document.getElementById('payment-modal');
        this.overlay = document.getElementById('payment-overlay');
        this.closeBtn = document.getElementById('payment-close');
        this.cancelBtn = document.getElementById('payment-cancel');
        this.saveBtn = document.getElementById('payment-save');
        this.courseSelect = document.getElementById('payment-course');
        this.amountInput = document.getElementById('payment-amount');
        this.dateInput = document.getElementById('payment-date');
        this.deleteBtn = document.getElementById('payment-delete');
        
        this.studentId = null;
        this.onSaved = null; 
        this.currentPaymentId = null;

        this.bindEvents();
    }

    /**
     * ДОБАВЛЕНО: установка ученика и callback.
     */
    setStudent(studentId, onSaved) {
        this.studentId = studentId;
        this.onSaved = onSaved || null;
    }


    bindEvents() {
        if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());
        if (this.cancelBtn) this.cancelBtn.addEventListener('click', () => this.close());
        if (this.overlay) this.overlay.addEventListener('click', () => this.close());

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) this.close();
        });

        // Сохранить пока ничего не делает — заглушка
        if (this.saveBtn) {
            this.saveBtn.addEventListener('click', () => this.handleSave());
        }
        if (this.deleteBtn) {                                                                    
            this.deleteBtn.addEventListener('click', () => this.handleDelete());                 
        }                                                                                        
    }

    isOpen() {
        return this.modal && this.modal.classList.contains('active');
    }

    async open(prefill = null) {
        if (this.modal) this.modal.classList.add('active');
        if (this.overlay) this.overlay.classList.add('active');

        // Сброс формы
        if (this.amountInput) this.amountInput.value = '';
        if (this.dateInput) this.dateInput.value = this.getToday();

        // Заголовок
        if (this.titleEl) {
            this.titleEl.textContent = prefill ? 'Редактировать оплату' : 'Добавить оплату';
        }

        // ДОБАВЛЕНО: кнопка «Удалить» только при редактировании
        if (this.deleteBtn) {
            this.deleteBtn.style.display = prefill ? 'inline-block' : 'none';
        }

        await this.loadCourses();

        // Предзаполнение
        if (prefill) {
            this.currentPaymentId = prefill.id;    // ДОБАВЛЕНО
            if (prefill.course_id) this.courseSelect.value = String(prefill.course_id);
            if (prefill.amount !== undefined) this.amountInput.value = prefill.amount;
            if (prefill.operation_date) this.dateInput.value = prefill.operation_date;
        } else {
            this.currentPaymentId = null;
        }

        setTimeout(() => this.amountInput?.focus(), 100);
    }

    close() {
        if (this.modal) this.modal.classList.remove('active');
        if (this.overlay) this.overlay.classList.remove('active');
    }

    async loadCourses() {
        if (!this.courseSelect) return;

        this.courseSelect.innerHTML = '<option value="" disabled selected>— Выберите курс —</option>';

        try {
            const response = await fetch('/api/load-courses/', {
                cache: 'no-store',
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            const data = await response.json();

            if (data.status === 'success') {
                const options = data.courses.map(c =>
                    `<option value="${c.id}">${this.escapeHtml(c.name)}</option>`
                ).join('');
                this.courseSelect.innerHTML =
                    '<option value="" disabled selected>— Выберите курс —</option>' + options;

                // ДОБАВЛЕНО: восстанавливаем последний выбранный курс
                const lastCourseId = localStorage.getItem(`last_payment_course_${this.studentId}`);
                if (lastCourseId && data.courses.some(c => String(c.id) === lastCourseId)) {
                    this.courseSelect.value = lastCourseId;
                }
            } else {
                console.error('Ошибка загрузки курсов:', data.message);
            }
        } catch (error) {
            console.error('❌ Ошибка load-courses:', error);
        }
    }

    /**
     * ДОБАВЛЕНО: реальное сохранение.
     */
    async handleSave() {
        const courseId = parseInt(this.courseSelect.value, 10);
        const amount = parseInt(this.amountInput.value, 10);
        const operationDate = this.dateInput.value;

        if (!courseId) {
            alert('Выберите курс');
            return;
        }
        if (isNaN(amount) || amount <= 0) {
            alert('Введите сумму больше 0');
            return;
        }
        if (!operationDate) {
            alert('Укажите дату');
            return;
        }
        if (!this.studentId) {
            alert('Не указан ученик');
            return;
        }

        this.saveBtn.disabled = true;
        this.saveBtn.textContent = 'Сохранение...';

        const payload = {
            student_id: this.studentId,
            course_id: courseId,
            amount: amount,
            operation_date: operationDate,
        };
        if (this.currentPaymentId) payload.id = this.currentPaymentId;

        try {
            const response = await fetch('/api/save-payment/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            console.log('📥 Ответ save-payment:', data);

            if (data.status === 'success') {
                // запоминаем выбранный курс для следующего открытия
                localStorage.setItem(`last_payment_course_${this.studentId}`, String(courseId));
                this.close();
                if (this.onSaved) this.onSaved();
            } else {
                alert('Ошибка: ' + (data.message || 'не удалось сохранить'));
            }
        } catch (error) {
            console.error('❌ Ошибка save-payment:', error);
            alert('Ошибка сети при сохранении');
        } finally {
            this.saveBtn.disabled = false;
            this.saveBtn.textContent = 'Сохранить';
        }
    }

    async handleDelete() {
        if (!this.currentPaymentId) return;
        if (!confirm('Удалить эту оплату?')) return;

        this.deleteBtn.disabled = true;
        this.deleteBtn.textContent = 'Удаление...';

        try {
            const response = await fetch('/api/delete-payment/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({ id: this.currentPaymentId })
            });
            const data = await response.json();
            console.log('📥 Ответ delete-payment:', data);

            if (data.status === 'success') {
                this.close();
                if (this.onSaved) this.onSaved();   // переиспользуем callback для обновления списка
            } else {
                alert('Ошибка: ' + (data.message || 'не удалось удалить'));
            }
        } catch (error) {
            console.error('❌ Ошибка delete-payment:', error);
            alert('Ошибка сети при удалении');
        } finally {
            this.deleteBtn.disabled = false;
            this.deleteBtn.textContent = 'Удалить';
        }
    }

    getToday() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
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