// import { CourseCreateModal } from './course-create-modal.js';
// import { CourseDeleteModal } from './course-delete-modal.js';

// ИЗМЕНЕНО: импорт функции вместо класса
import { getCourseCreateModal } from './course-create-modal.js';
import { getCourseDeleteModal } from './course-delete-modal.js';

/**
 * Модалка добавления стоимости курса для ученика.
 * Пока сохранить нельзя — только открытие/закрытие.
 */
export class CoursePriceModal {
    constructor() {
        this.modal = document.getElementById('course-price-modal');
        this.overlay = document.getElementById('course-price-overlay');
        this.closeBtn = document.getElementById('course-price-close');
        this.cancelBtn = document.getElementById('course-price-cancel');
        this.saveBtn = document.getElementById('course-price-save');
        this.courseSelect = document.getElementById('course-price-course');
        this.valueInput = document.getElementById('course-price-value');
        this.deleteBtn = document.getElementById('course-price-delete');

        this.createModal = getCourseCreateModal();   // ИЗМЕНЕНО
        this.deleteModal = getCourseDeleteModal();   // ИЗМЕНЕНО

        this._loadedCourses = [];   // кэш курсов, загруженных для dropdown

        this.studentId = null;      // ДОБАВЛЕНО: id ученика
        this.onSaved = null;        // ДОБАВЛЕНО: callback после сохранения
        this.currentPriceId = null;


        this.bindEvents();
    }

    /**
     * ДОБАВЛЕНО: устанавливает ученика и callback, вызывается снаружи (из CoursePricesService).
     */
    setStudent(studentId, onSaved) {
        this.studentId = studentId;
        this.onSaved = onSaved || null;
    }


    bindEvents() {
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.close());
        }
        if (this.cancelBtn) {
            this.cancelBtn.addEventListener('click', () => this.close());
        }
        if (this.overlay) {
            this.overlay.addEventListener('click', () => this.close());
        }
        // Esc — глобально, но только пока модалка открыта
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) this.close();
        });
        // ИЗМЕНЕНО: «Сохранить» теперь реально сохраняет
        if (this.saveBtn) {
            this.saveBtn.addEventListener('click', () => this.handleSave());
        }

        // Слушаем выбор в dropdown
        if (this.courseSelect) {
            this.courseSelect.addEventListener('change', () => {
                const value = this.courseSelect.value;

                if (value === '__add_new__') {
                    this.courseSelect.value = '';
                    this.createModal.open((created) => this.onCourseCreated(created));
                } else if (value === '__delete__') {
                    this.courseSelect.value = '';
                    // Открываем модалку удаления только если есть курсы
                    const courses = this.getLoadedCourses();
                    if (courses.length === 0) return;
                    this.deleteModal.open(courses, (deletedId) => this.onCourseDeleted(deletedId));
                }
            });
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
        if (this.valueInput) this.valueInput.value = '';
        await this.loadCourses();

         // ДОБАВЛЕНО: показываем кнопку удаления только при редактировании
        if (this.deleteBtn) {
            this.deleteBtn.style.display = prefill ? 'inline-block' : 'none';
        }

        // ДОБАВЛЕНО: запоминаем id цены при редактировании (нужен для delete)
        this.currentPriceId = prefill?.priceId || null;

        // ДОБАВЛЕНО: применяем предзаполнение после загрузки курсов
        if (prefill) {
            if (prefill.courseId) {
                this.courseSelect.value = String(prefill.courseId);
            }
            if (prefill.price !== undefined && prefill.price !== null) {
                this.valueInput.value = prefill.price;
            }
        }

        setTimeout(() => this.valueInput?.focus(), 100);
    }
    close() {
        if (this.modal) this.modal.classList.remove('active');
        if (this.overlay) this.overlay.classList.remove('active');
    }

    async loadCourses() {
        if (!this.courseSelect) return;

        // Сразу показываем "— Добавить курс —" первым
        this.courseSelect.innerHTML = '<option value="" disabled selected>— Выберите курс —</option>';

        try {
            const response = await fetch('/api/load-courses/', {
                cache: 'no-store',
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            const data = await response.json();

            if (data.status === 'success') {
                this._loadedCourses = data.courses;   // сохраняем в кэш
                this.renderCourseOptions(data.courses);
            } else {
                console.error('Ошибка загрузки курсов:', data.message);
            }
        } catch (error) {
            console.error('❌ Ошибка load-courses:', error);
        }
    }

    renderCourseOptions(courses) {
        const options = courses.map(c =>
            `<option value="${c.id}">${this.escapeHtml(c.name)}</option>`
        ).join('');

        // Пункт «Удалить курс» показываем только если есть хотя бы один курс
        const deleteOption = courses.length > 0
            ? '<option value="__delete__">— Удалить курс —</option>'
            : '';

        this.courseSelect.innerHTML = `
            <option value="" disabled selected>— Выберите курс —</option>
            ${options}
            <option value="__add_new__">+ Добавить курс</option>
            ${deleteOption}
        `;
    }

    /**
     * ДОБАВЛЕНО: отправляет цену на сервер.
     */
    async handleSave() {
        const courseId = parseInt(this.courseSelect.value, 10);
        const price = parseInt(this.valueInput.value, 10);

        // Валидация
        if (!courseId) {
            alert('Выберите курс');
            return;
        }
        if (isNaN(price) || price < 0) {
            alert('Введите корректную цену (целое число ≥ 0)');
            return;
        }
        if (!this.studentId) {
            alert('Не указан ученик');
            return;
        }

        this.saveBtn.disabled = true;
        this.saveBtn.textContent = 'Сохранение...';

        try {
            const response = await fetch('/api/save-course-price/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({
                    student_id: this.studentId,
                    course_id: courseId,
                    price_per_lesson: price
                })
            });
            const data = await response.json();
            console.log('📥 Ответ save-course-price:', data);

            if (data.status === 'success') {
                this.close();
                if (this.onSaved) this.onSaved();
            } else {
                alert('Ошибка: ' + (data.message || 'не удалось сохранить'));
            }
        } catch (error) {
            console.error('❌ Ошибка save-course-price:', error);
            alert('Ошибка сети при сохранении');
        } finally {
            this.saveBtn.disabled = false;
            this.saveBtn.textContent = 'Сохранить';
        }
    }

     async handleDelete() {
        if (!this.currentPriceId) return;
        if (!confirm('Удалить цену этого курса?')) return;

        this.deleteBtn.disabled = true;
        this.deleteBtn.textContent = 'Удаление...';

        try {
            const response = await fetch('/api/delete-course-price/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                },
                body: JSON.stringify({ id: this.currentPriceId })
            });
            const data = await response.json();
            console.log('📥 Ответ delete-course-price:', data);

            if (data.status === 'success') {
                this.close();
                if (this.onSaved) this.onSaved();
            } else {
                alert('Ошибка: ' + (data.message || 'не удалось удалить'));
            }
        } catch (error) {
            console.error('❌ Ошибка delete-course-price:', error);
            alert('Ошибка сети при удалении');
        } finally {
            this.deleteBtn.disabled = false;
            this.deleteBtn.textContent = 'Удалить';
        }
    }

    getLoadedCourses() {
        return this._loadedCourses || [];
    }

    onCourseCreated(created) {
        // Добавляем новый курс в dropdown и выбираем его
        const option = document.createElement('option');
        option.value = created.id;
        option.textContent = created.name;

        // Вставляем перед "+ Добавить курс"
        const addNewOption = this.courseSelect.querySelector('option[value="__add_new__"]');
        if (addNewOption) {
            this.courseSelect.insertBefore(option, addNewOption);
        } else {
            this.courseSelect.appendChild(option);
        }
        // ДОБАВЛЕНО: синхронизируем кэш, чтобы удаление видело новый курс
        this._loadedCourses.push({ id: created.id, name: created.name });

        this.courseSelect.value = created.id;
    }

    // ИЗМЕНЕНО: принимает mode, чтобы по-разному реагировать
    onCourseDeleted(deletedId, mode) {
        // Убираем удалённый курс из кэша — работает и для archive, и для hard
        this._loadedCourses = this._loadedCourses.filter(c => c.id !== deletedId);

        // Перерисовываем dropdown
        this.renderCourseOptions(this._loadedCourses);

        console.log(`🗑️ Курс ${deletedId} (${mode}) убран из списка`)
        ;
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

