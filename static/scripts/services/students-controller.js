/**
 * Контроллер страницы учеников
 * Этап 1: управление модальным окном (открытие/закрытие)
 */

export class StudentsController {
    constructor() {
        // Находим элементы на странице
        this.addBtn = document.getElementById('add-student-btn');
        this.modal = document.getElementById('add-modal');
        this.overlay = document.getElementById('modal-overlay');
        this.btnCancel = document.getElementById('add-modal-cancel');
        this.btnClose = this.modal?.querySelector('.close');

        // Элементы формы
        this.form = document.getElementById('add-student-form');
        this.inputFirstName = document.getElementById('first-name');
        this.inputLastName = document.getElementById('last-name');
        this.btnOk = document.getElementById('add-modal-ok');

        // Контейнер списка
        this.listContainer = document.getElementById('students-list');

        // Локальное хранилище учеников
        this.students = [];


        // Редактирование учеников
        this.editModal = document.getElementById('edit-modal');
        this.editInputId = document.getElementById('edit-student-id');
        this.editInputFirstName = document.getElementById('edit-first-name');
        this.editInputLastName = document.getElementById('edit-last-name');
        this.editBtnOk = document.getElementById('edit-modal-ok');
        this.editBtnCancel = document.getElementById('edit-modal-cancel');
        this.editBtnDelete = document.getElementById('edit-modal-delete');
        this.editBtnClose = this.editModal?.querySelector('.close');

        this.init();
        this.ready = this.loadStudents();
    }

    /**
     * Навешиваем обработчики событий
     */
    init() {
        // Кнопка "Добавить ученика" — открыть окно
        if (this.addBtn) {
            this.addBtn.addEventListener('click', () => this.openModal());
        }

        // Кнопка "Отмена" — закрыть
        if (this.btnCancel) {
            this.btnCancel.addEventListener('click', () => this.closeModal());
        }

        // Крестик в углу — закрыть
        if (this.btnClose) {
            this.btnClose.addEventListener('click', () => this.closeModal());
        }

        // Клик по затемнению — закрыть
        if (this.overlay) {
            this.overlay.addEventListener('click', () => {
                this.closeModal();
                this.closeEditModal();
            });
        }

        // Кнопка "Esc" — закрыть
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                this.closeEditModal();
            }
                
        });

        // Кнопка "Добавить" в модалке
        if (this.btnOk) {
            this.btnOk.addEventListener('click', () => this.handleSave());
        }

        // Enter в форме тоже отправляет
        if (this.form) {
            this.form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSave();
            });
        }

        // Модалка редактирования
        if (this.editBtnCancel) {
            this.editBtnCancel.addEventListener('click', () => this.closeEditModal());
        }
        if (this.editBtnClose) {
            this.editBtnClose.addEventListener('click', () => this.closeEditModal());
        }
        if (this.editBtnOk) {
            this.editBtnOk.addEventListener('click', () => {
                // TODO: сохранение (следующий этап)
                this.handleUpdate()
                console.log('🖊 Сохранить ученика id=', this.editInputId.value);
                this.closeEditModal();
            });
        }
        if (this.editBtnDelete) {
            this.editBtnDelete.addEventListener('click', () => {
                // TODO: удаление (следующий этап)
                this.handleDelete()
                console.log('🗑 Удалить ученика id=', this.editInputId.value);
                this.closeEditModal();
            });
        }
    }

     /* ==================== ЗАГРУЗКА СПИСКА ==================== */

    async loadStudents() {
        // Показываем "загрузка" только если есть куда рендерить
        this.renderLoading();

        try {
            const response = await fetch('/api/load-students/', {
                method: 'GET',
                cache: 'no-store',  // ← отключает кэширование
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });

            const data = await response.json();
            console.log('📥 Список учеников:', data);

            if (data.status === 'success') {
                this.students = data.students;
                this.renderStudents();
            } else {
                if (this.listContainer) {
                    this.renderError(data.message || 'Ошибка загрузки');
                }
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки:', error);
            this.renderError('Ошибка сети');
        }
    }

    /* ==================== РЕНДЕРИНГ ==================== */

    renderLoading() {
        if (!this.listContainer) return;
        this.listContainer.innerHTML = '<div class="students-loading">Загрузка...</div>';
    }

    renderError(message) {
        if (!this.listContainer) return;
        this.listContainer.innerHTML = `<div class="students-error">${message}</div>`;
    }

    renderStudents() {
        if (!this.listContainer) return;

        if (this.students.length === 0) {
            this.listContainer.innerHTML = '<div class="students-empty">Пока нет добавленных учеников</div>';
            return;
        }

        this.listContainer.innerHTML = this.students.map(student => `
            <div class="student-item" data-id="${student.id}">
                <div class="student-info">
                    <span class="student-name">${this.escapeHtml(student.full_name)}</span>
                    <span class="student-date">добавлен ${student.created_at}</span>
                </div>
                <button class="btn-edit-icon" type="button" title="Редактировать">✎</button>
            </div>
        `).join('');

        // Клик по карточке — открыть редактирование
        this.listContainer.querySelectorAll('.student-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.getAttribute('data-id'), 10);
                window.location.href = `/students/${id}/`;
            });
        });

        // Клик по иконке — открыть модалку редактирования
        this.listContainer.querySelectorAll('.btn-edit-icon').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.closest('.student-item').getAttribute('data-id'), 10);
                this.openEditModal(id);
            });
        });
    }

    /**
     * Открыть модальное окно
     */
    openModal() {
        this.closeEditModal();
        if (this.modal) this.modal.classList.add('active');
        if (this.overlay) this.overlay.classList.add('active');
    }

    /**
     * Закрыть модальное окно
     */
    closeModal() {
        if (this.modal) this.modal.classList.remove('active');
        if (this.overlay) this.overlay.classList.remove('active');
    }

    /* ==================== МОДАЛКА РЕДАКТИРОВАНИЯ ==================== */

    openEditModal(studentId) {
        this.closeModal();   
        const student = this.students.find(s => s.id === studentId);
        if (!student) {
            console.warn('⚠️ Ученик не найден:', studentId);
            return;
        }

        // Заполняем поля
        this.editInputId.value = student.id;
        this.editInputFirstName.value = student.first_name;
        this.editInputLastName.value = student.last_name;

        // Показываем модалку
        if (this.editModal) this.editModal.classList.add('active');
        if (this.overlay) this.overlay.classList.add('active');

        // Фокус
        setTimeout(() => this.editInputFirstName?.focus(), 100);
    }

    closeEditModal() {
        if (this.editModal) this.editModal.classList.remove('active');
        if (this.overlay) this.overlay.classList.remove('active');
    }


    /* ==================== СОХРАНЕНИЕ ==================== */

    async handleSave() {
        const firstName = this.inputFirstName?.value.trim();
        const lastName = this.inputLastName?.value.trim();

        // Валидация
        if (!firstName || !lastName) {
            alert('Заполните имя и фамилию');
            return;
        }

        // Блокируем кнопку
        this.btnOk.disabled = true;
        this.btnOk.textContent = 'Сохранение...';

        try {
            const response = await fetch('/api/save-student/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({
                    first_name: firstName,
                    last_name: lastName
                })
            });

            const data = await response.json();
            console.log('📥 Ответ сервера:', data);

            if (data.status === 'success') {
                console.log('✅ Ученик добавлен:', data.full_name);
                this.closeModal();
                await this.loadStudents();
            } else {
                alert('Ошибка: ' + (data.message || 'неизвестная ошибка'));
            }
        } catch (error) {
            console.error('❌ Ошибка запроса:', error);
            alert('Ошибка сети при сохранении');
        } finally {
            this.btnOk.disabled = false;
            this.btnOk.textContent = 'Добавить';
        }
    }

    /* ==================== ОБНОВЛЕНИЕ ==================== */
    
    async handleUpdate() {
        const id = parseInt(this.editInputId.value, 10);
        const firstName = this.editInputFirstName.value.trim();
        const lastName = this.editInputLastName.value.trim();

        if (!firstName || !lastName) {
            alert('Заполните имя и фамилию');
            return;
        }

        this.editBtnOk.disabled = true;
        this.editBtnOk.textContent = 'Сохранение...';

        try {
            const response = await fetch('/api/update-student/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({
                    id: id,
                    first_name: firstName,
                    last_name: lastName
                })
            });

            const data = await response.json();
            console.log('📥 Ответ обновления:', data);

            if (data.status === 'success') {
                this.closeEditModal();
                await this.loadStudents();

                // Если открыта страница ученика — обновляем её DOM
                const detailPage = document.getElementById('student-detail-page');
                if (detailPage) {
                    const fullName = `${lastName} ${firstName}`;
                    const nameEl = detailPage.querySelector('.student-detail-name');
                    if (nameEl) nameEl.textContent = fullName;
                    document.title = fullName;
                }
            } else {
                alert('Ошибка: ' + (data.message || 'неизвестная ошибка'));
            }
        } catch (error) {
            console.error('❌ Ошибка обновления:', error);
            alert('Ошибка сети при сохранении');
        } finally {
            this.editBtnOk.disabled = false;
            this.editBtnOk.textContent = 'Сохранить';
        }
    }

    /* ==================== УДАЛЕНИЕ ==================== */

    async handleDelete() {
        const id = parseInt(this.editInputId.value, 10);

        if (!id) return;
        if (!confirm('Удалить этого ученика?')) return;

        this.editBtnDelete.disabled = true;
        this.editBtnDelete.textContent = 'Удаление...';

        try {
            const response = await fetch('/api/delete-student/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({ id: id })
            });

            const data = await response.json();
            console.log('📥 Ответ удаления:', data);

            if (data.status === 'success') {
                this.closeEditModal();
                // Если мы на странице ученика — возвращаемся туда, откуда пришли
                const detailPage = document.getElementById('student-detail-page');
                if (detailPage) {
                    const referrer = document.referrer;
                    const isInternal = referrer && new URL(referrer).origin === window.location.origin;

                    if (isInternal && window.history.length > 1) {
                        window.history.back();
                    } else {
                        window.location.href = '/students/';
                    }
                    return;
                }

                // Если на странице со списком — просто перерисовываем
                if (this.listContainer) {
                    await this.loadStudents();
                }
            } else {
                alert('Ошибка: ' + (data.message || 'неизвестная ошибка'));
            }
        } catch (error) {
            console.error('❌ Ошибка удаления:', error);
            alert('Ошибка сети при удалении');
        } finally {
            this.editBtnDelete.disabled = false;
            this.editBtnDelete.textContent = 'Удалить';
        }
    }
    

    /* ==================== УТИЛИТЫ ==================== */

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