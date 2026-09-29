import { timeUtils, dateUtils, storageUtils } from '../utils/utils.js';

import { EventDTO } from '../models/event-dto.js';
import { EVENT_FIELDS } from '../constants/event-fields.js';

import { getCourseCreateModal } from './course-create-modal.js';    // ДОБАВЛЕНО
import { getCourseDeleteModal } from './course-delete-modal.js';    // ДОБАВЛЕНО

export class EventModal {
    constructor(apiService, overlayManager,eventManager) {
        this.apiService = apiService;
        this.overlayManager = overlayManager;
        this.eventManager = eventManager;

        this.currentCell = null;
        this.selectedColor = null;
        this.isEditing = false;

        // Состояние выбранных учеников
        this.selectedStudentIds = [];   // массив ID
        this.allStudents = [];          // кэш последнего загруженного списка

        // выбор курса
        this.selectedCourseId = null;    
        this._loadedCourses = [];        
        this.courseCreateModal = getCourseCreateModal(); 
        this.courseDeleteModal = getCourseDeleteModal(); 

        this.currentEventData = null;    // ДОБАВЛЕНО: полные данные открытого события

        // ДОБАВЛЕНО: определяем, суперюзер ли текущий пользователь
        const meta = document.querySelector('meta[name="is-superuser"]');
        this.isSuperuser = meta && meta.getAttribute('content') === 'true';

        this.elements = {
            modal: document.getElementById('event-modal'),
            overlay: document.getElementById('modal-overlay'),
            timeInfo: document.getElementById('modal-time-info'),
            modalTitle: document.getElementById('event-modal-title'),
            textInput: document.getElementById('event-text'),
            startMinutesInput: document.getElementById('event-start-minutes'),
            durationInput: document.getElementById('event-duration'),
            recurringCheckbox: document.getElementById('is-recurring'),
            colorOptions: document.querySelectorAll('.color-option'),
            deleteButton: document.getElementById('delete-note'),
            eventIdInput: document.getElementById('event-id'),
            selectDaysBtn: document.getElementById('select-days-btn'),
            moveButton: document.getElementById('move-note'),

            // Элементы модального окна выбора дня недели
            daysModal: document.getElementById('days-modal'),
            daysOverlay: document.getElementById('days-modal-overlay'),
            daysCheckboxes: document.querySelectorAll('.days-checkboxes input'),
            daysModalOk: document.getElementById('days-modal-ok'),
            daysModalCancel: document.getElementById('days-modal-cancel'),


            // Элементы модального окна переноса заметки
            moveModal: document.getElementById('move-modal'),
            moveOverlay: document.getElementById('move-modal-overlay'),
            moveDateInput: document.getElementById('move-date'),
            moveTimeSelect: document.getElementById('move-time'),
            moveStartMinutesInput: document.getElementById('move-start-minutes'),
            moveModalOk: document.getElementById('move-modal-ok'),
            moveModalCancel: document.getElementById('move-modal-cancel'),

            // Элементы модального окна выбора учеников
            addStudentsBtn: document.getElementById('add-students-btn'),
            studentsModal: document.getElementById('event-students-modal'),
            studentsOverlay: document.getElementById('event-students-overlay'),
            studentsList: document.getElementById('event-students-list'),
            studentsOk: document.getElementById('event-students-ok'),
            studentsCancel: document.getElementById('event-students-cancel'),
            studentsClose: document.getElementById('event-students-close'),

            selectedStudentsList: document.getElementById('selected-students-list'),

            // выбор курса
            courseGroup: document.getElementById('event-course-group'),
            courseSelect: document.getElementById('event-course'),

            // изменение статуса занятия
            completionGroup: document.getElementById('event-completion-group'),    
            completionSelect: document.getElementById('event-completion-status'),  

            // изменение посещаемости учеников
            attendanceGroup: document.getElementById('event-attendance-group'),      
            openAttendanceBtn: document.getElementById('open-attendance-btn'),       
            attendanceModal: document.getElementById('attendance-modal'),             
            attendanceOverlay: document.getElementById('attendance-overlay'),         
            attendanceList: document.getElementById('attendance-list'),               
            attendanceClose: document.getElementById('attendance-close'),             
            attendanceCancel: document.getElementById('attendance-cancel'),           
            attendanceSave: document.getElementById('attendance-save'),               
        };

        this.dayNames = {
            'mon': 'Понедельник',
            'tue': 'Вторник',
            'wed': 'Среда',
            'thu': 'Четверг',
            'fri': 'Пятница',
            'sat': 'Суббота',
            'sun': 'Воскресенье'
        };

        this.bindEvents();
    }

    bindEvents() {
        // Обработчики цветов
        this.elements.colorOptions.forEach(option => {
            option.addEventListener('click', () => this.handleColorSelect(option));
        });

        // Валидация времени
        this.elements.durationInput.addEventListener('input', (e) => {
            this.validateTimeInput(e.target);
        });

        // Обработчики нажатий модального окна выбора дня недели
        this.elements.selectDaysBtn.addEventListener('click', () => this.showDaysModal());
        this.elements.daysModalOk.addEventListener('click', () => this.saveSelectedDays());
        this.elements.daysModalCancel.addEventListener('click', () => this.hideDaysModal());
        this.elements.daysOverlay.addEventListener('click', () => this.hideDaysModal());

        // Обработчики для переноса
        this.elements.moveButton.addEventListener('click', () => this.showMoveModal());
        this.elements.moveModalOk.addEventListener('click', () => this.moveEvent());
        this.elements.moveModalCancel.addEventListener('click', () => this.hideMoveModal());
        this.elements.moveOverlay.addEventListener('click', () => this.hideMoveModal());

        // Обработчики модального окна выбора учеников
        if (this.elements.addStudentsBtn) {
            this.elements.addStudentsBtn.addEventListener('click', () => this.showStudentsModal());
        }
        if (this.elements.studentsOk) {
            this.elements.studentsOk.addEventListener('click', () => {
                this.applySelectedStudents()
                this.hideStudentsModal();
            });
        }
        if (this.elements.studentsCancel) {
            this.elements.studentsCancel.addEventListener('click', () => this.hideStudentsModal());
        }
        if (this.elements.studentsClose) {
            this.elements.studentsClose.addEventListener('click', () => this.hideStudentsModal());
        }
        if (this.elements.studentsOverlay) {
            this.elements.studentsOverlay.addEventListener('click', () => this.hideStudentsModal());
        }

        // выбор курса
        if (this.elements.courseSelect) {
            this.elements.courseSelect.addEventListener('change', () => {
                const value = this.elements.courseSelect.value;

                if (value === '__add_new__') {
                    this.elements.courseSelect.value = '';
                    this.courseCreateModal.open((created) => this.onCourseCreated(created));
                } else if (value === '__delete__') {
                    this.elements.courseSelect.value = '';
                    if (this._loadedCourses.length === 0) return;
                    this.courseDeleteModal.open(this._loadedCourses, (id, mode) => this.onCourseDeleted(id, mode));
                } else if (value) {                                          // ← ДОБАВЛЕНО
                    // Обычный выбор курса — сохраняем ID
                    this.selectedCourseId = parseInt(value, 10);             // ← ДОБАВЛЕНО
                } else {                                                     // ← ДОБАВЛЕНО
                    this.selectedCourseId = null;                            // ← ДОБАВЛЕНО
                }
            });
        }        
        
        // модалка изменения посещаемости нескольких учеников в группе

        if (this.elements.openAttendanceBtn) {                                                           
            this.elements.openAttendanceBtn.addEventListener('click', () => this.openAttendanceModal()); 
        }                                                                                                 
        if (this.elements.attendanceClose) {                                                              
            this.elements.attendanceClose.addEventListener('click', () => this.closeAttendanceModal());   
        }                                                                                                 
        if (this.elements.attendanceCancel) {                                                             
            this.elements.attendanceCancel.addEventListener('click', () => this.closeAttendanceModal());  
        }                                                                                                 
        if (this.elements.attendanceOverlay) {                                                            
            this.elements.attendanceOverlay.addEventListener('click', () => this.closeAttendanceModal()); 
        }                                                                                                 
        if (this.elements.attendanceSave) {                                                               
            this.elements.attendanceSave.addEventListener('click', () => this.handleAttendanceSave());    
        }                                                                                                 
    }

    // ПОКАЗАТЬ МОДАЛЬНОЕ ОКНО ПЕРЕНОСА
    showMoveModal() {
        if (!this.isEditing || !this.currentEvent) {
            console.warn('Нет события для переноса');
            return;
        }

        // Заполняем текущими значениями
        const dto = new EventDTO(this.currentEvent);
        this.elements.moveDateInput.value = dto.date;
        
        // Заполняем выпадающий список временем
        this.populateTimeSelect(dto.time);
        
        this.elements.moveModal.style.display = 'block';
        this.elements.moveOverlay.style.display = 'block';
    }

    // ЗАПОЛНИТЬ ВЫПАДАЮЩИЙ СПИСОК ВРЕМЕНИ ДЛЯ ПЕРЕНОСА
    populateTimeSelect(currentTime) {
        const timeSelect = this.elements.moveTimeSelect;
        timeSelect.innerHTML = '';

        // Парсим текущее время
        const [currentHours, currentMinutes] = currentTime.split(':').map(Number);

        // Создаем опции с 8:00 до 20:00 с шагом в 1 час
        for (let hour = 8; hour <= 20; hour++) {
            const timeValue = `${hour.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')}`;
            const displayTime = `${hour}:${currentMinutes.toString().padStart(2, '0')}`;
            
            const option = document.createElement('option');
            option.value = timeValue;
            option.textContent = displayTime;
            option.selected = hour === currentHours;
            timeSelect.appendChild(option);
        }
    }

    // ПЕРЕНЕСТИ СОБЫТИЕ (СРАЗУ ПРИ НАЖАТИИ ОК В МОДАЛЬНОМ ОКНЕ ПЕРЕНОСА)
    async moveEvent() {
        if (!this.isEditing || !this.currentEvent) return;

        const newDate = this.elements.moveDateInput.value;
        const newTime = this.elements.moveTimeSelect.value;

        if (!newDate) {
            alert('Пожалуйста, выберите дату');
            return;
        }

        // console.log('🔄 Начало переноса...');

        try {
            const isRecurring = this.currentEvent.is_recurring;

            if (isRecurring) {
                const seriesId = this.currentEvent.series_id;
                const seriesEvents = await this.apiService.loadSeriesEvents(seriesId);
                
                if (!seriesEvents || seriesEvents.length === 0) {
                    alert('Не удалось загрузить события серии');
                    return;
                }

                console.log(`📦 Найдено событий в серии: ${seriesEvents.length}`);

                // 1. УДАЛЯЕМ ВСЮ СЕРИЮ ОДНИМ ЗАПРОСОМ
                console.log('🗑️ Удаляем всю серию...');
                const firstEvent = seriesEvents[0];
                const deleteResponse = await this.apiService.deleteEvent(firstEvent.id, true);

                if (deleteResponse.status !== 'success') {
                    throw new Error('Не удалось удалить серию: ' + deleteResponse.message);
                }

                // Обновляем текущую неделю
                this.overlayManager.refreshCurrentWeek();

                // 2. СОЗДАЕМ НОВУЮ СЕРИЮ В НОВОМ МЕСТЕ
                console.log('🔄 Создаем новую серию...');
                let createdCount = 0;
                
                for (const event of seriesEvents) {
                    try {
                        const newEventData = {
                            ...event,
                            date: newDate,
                            time: newTime,
                            id: null,
                            series_id: seriesId, // сохраняем тот же series_id
                            is_recurring: true
                        };

                        delete newEventData.overlay;

                        // Валидация
                        const dto = new EventDTO(newEventData);
                        const validationErrors = dto.validate();
                        if (validationErrors.length > 0) continue;

                        // Сохраняем новое событие
                        const saveResponse = await this.apiService.saveEvent(newEventData);
                        if (saveResponse.status === 'success') {
                            // Создаем overlay
                            this.overlayManager.createFromData({
                                ...newEventData,
                                id: saveResponse.id
                            });
                            createdCount++;
                        }
                    } catch (error) {
                        console.error(`❌ Ошибка создания события:`, error);
                    }
                }

                console.log(`✅ Создано ${createdCount} новых событий из ${seriesEvents.length}`);

            } else {
                // ДЛЯ НЕРЕГУЛЯРНЫХ СОБЫТИЙ
                await this.moveSingleEventInstance(this.currentEvent, newDate, newTime);
            }

        } catch (error) {
            console.error('❌ Ошибка:', error);
            alert(`Ошибка переноса: ${error.message}`);
            return;
        }

        this.hideMoveModal();
        this.hide();
    }

    // ПЕРЕНЕСТИ ОДИНОЧНОЕ СОБЫТИЕ
    async moveSingleEventInstance(event, newDate, newTime) {
        try {
            // Создаем копию события с новой датой и временем
            const movedEventData = {
                ...event,
                date: newDate,
                time: newTime,
                id: null
            };

            // Для одиночных событий снимаем регулярность
            if (!event.series_id) {
                movedEventData.is_recurring = false;
                movedEventData.series_id = null;
            }

            delete movedEventData.overlay;

            // Валидация
            const dto = new EventDTO(movedEventData);
            const validationErrors = dto.validate();
            if (validationErrors.length > 0) {
                console.error('Ошибка валидации:', validationErrors);
                return;
            }

            // Сохраняем новое событие
            const saveResponse = await this.apiService.saveEvent(movedEventData);
            
            if (saveResponse.status === 'success') {
                // Удаляем старое событие
                const deleteResponse = await this.apiService.deleteEvent(event.id, false);
                
                if (deleteResponse.status === 'success') {
                    this.overlayManager.remove(event.id);
                    this.overlayManager.createFromData({
                        ...movedEventData,
                        id: saveResponse.id
                    });
                    // console.log(`✅ Событие ${event.id} -> ${saveResponse.id} перенесено`);
                } else {
                    console.error('❌ Ошибка удаления старого события');
                    // Откатываем создание нового
                    await this.apiService.deleteEvent(saveResponse.id, false);
                }
            } else {
                console.error('Ошибка при переносе:', saveResponse.message);
            }
        } catch (error) {
            console.error('Ошибка при переносе события:', error);
        }
    }



    // СКРЫТЬ МОДАЛЬНОЕ ОКНО ПЕРЕНОСА
    hideMoveModal() {
        this.elements.moveModal.style.display = 'none';
        this.elements.moveOverlay.style.display = 'none';
    }

    // ПОКАЗАТЬ МОДАЛЬНОЕ ОКНО ВЫБОРА ДНЕЙ
    showDaysModal() {
        this.elements.daysModal.style.display = 'block';
        this.elements.daysOverlay.style.display = 'block';

        // Сбрасываем чекбоксы
        this.elements.daysCheckboxes.forEach(checkbox => {
            checkbox.checked = false;
        });

        // Восстанавливаем ранее выбранные дни
        this.selectedDays.forEach(day => {
            const checkbox = document.querySelector(`.days-checkboxes input[value="${day}"]`);
            if (checkbox) checkbox.checked = true;
        });
    }

    // СОХРАНИТЬ ВЫБРАННЫЕ ДНИ
    saveSelectedDays() {
        this.selectedDays = [];

        this.elements.daysCheckboxes.forEach(checkbox => {
            if (checkbox.checked) {
                this.selectedDays.push(checkbox.value);
            }
        });

        this.hideDaysModal();

        // Обновляем текст кнопки чтобы показать количество выбранных дней
        this.updateDaysButtonText();
    }

    // ОБНОВИТЬ ТЕКСТ КНОПКИ
    updateDaysButtonText() {
        const btn = this.elements.selectDaysBtn;
        if (this.selectedDays.length === 0) {
            btn.textContent = 'Дни';
        } else {
            btn.textContent = `Дни (${this.selectedDays.length})`;
        }
    }

    // СКРЫТЬ МОДАЛЬНОЕ ОКНО ВЫБОРА ДНЕЙ
    hideDaysModal() {
        this.elements.daysModal.style.display = 'none';
        this.elements.daysOverlay.style.display = 'none';
    }

    async show(eventData=null,cell=null, targetUserId = null) {
        this.currentCell = cell;
        this.selectedColor = null;
        this.targetUserId = targetUserId; // ← СОХРАНЯЕМ
        this.isEditing = !!eventData;
        this.currentEvent=eventData;

        // Сбрасываем состояние
        this.resetModal();

        let date, time, day;

        if (eventData) {
            // РЕДАКТИРОВАНИЕ - данные из eventData
            const dto = new EventDTO(eventData);
            date = dto.date;
            time = dto.time;
            day = dateUtils.getDayFromDate(date);
        } else {
            // НОВАЯ ЗАМЕТКА - данные из ячейки
            date = this.currentCell.getAttribute('data-date');
            time = this.currentCell.getAttribute('data-time');
            day = this.currentCell.getAttribute('data-day');
        }

        // ФОРМАТИРУем ДАТУ
        const formattedDate = dateUtils.formatDate(date);

        // Устанавливаем информацию о времени
        this.elements.timeInfo.textContent =
            `${this.dayNames[day]}, ${formattedDate} ${time}`;

        if (eventData) {
            this.populateEditForm(eventData);
        } else {
            this.setupNewEventForm();
        }

        this.toggleDeleteButton();
        this.toggleMoveButton();
        this.updateModalText();

        // выбор курса
        await this.loadCoursesForEvent();    // ДОБАВЛЕНО
        this.updateCourseVisibility();       // ДОБАВЛЕНО

        // ДОБАВЛЕНО: прячем кнопку «Добавить ученика» для не-суперюзеров
        if (this.elements.addStudentsBtn) {
            this.elements.addStudentsBtn.style.display = this.isSuperuser ? '' : 'none';
        }

        this.showModal();
        this.elements.textInput.focus();
    }

    hide() {
        this.elements.modal.style.display = 'none';
        this.elements.overlay.style.display = 'none';
        this.currentCell = null;
        this.isEditing = false;
    }

    /**
     * Получить ID текущего пользователя
     */
    getCurrentUserId() {
        const userElement = document.querySelector('[data-user-id]');
        return userElement ? userElement.dataset.userId : null;
    }

    async save() {
        const eventData = this.getFormData();
        if (!eventData) return;    // ДОБАВЛЕНО: валидация не прошла
        // ДОБАВЛЯЕМ: Устанавливаем created_by и canEdit для новых событий
        if (!this.isEditing) {
            const currentUserId = this.getCurrentUserId();
            if (currentUserId) {
                eventData.created_by = Number(currentUserId);
                eventData.canEdit = true;
            }
        }

        // Используем валидацию из DTO
        const dto = new EventDTO(eventData);
        const validationErrors = dto.validate();

        if (validationErrors.length > 0) {
            alert(validationErrors.join('\n'));
            return;
        }

        // Сохраняем продолжительность
        storageUtils.saveLastDuration(this.elements.durationInput.value);

        //Передаем target_user_id при создании новой заметки в чужом расписании
        if (!this.isEditing && this.targetUserId) {
            eventData.target_user_id = this.targetUserId;
        }
        console.log('📋 Выбранные ученики при сохранении:', this.selectedStudentIds);
        try {
            // ЕСЛИ ВЫБРАНЫ ДНИ - создаем события для каждого дня
            if (this.selectedDays.length > 0) {
                await this.saveMultipleEvents(eventData);
            } else {
                // ✅ ПРОСТО ВЫЗЫВАЕМ EVENT MANAGER - ВСЯ ЛОГИКА ТАМ
                const savedEvent = await this.eventManager.createEvent(eventData);
                
                // УДАЛЯЕМ СТАРЫЙ OVERLAY ПЕРЕД СОЗДАНИЕМ НОВОГО
                if (this.isEditing && eventData.id) {
                    this.overlayManager.remove(eventData.id);
                }
                
                // console.log('✅ Событие создано через EventManager:', savedEvent);
            }
            this.hide();
        } catch (error) {
            console.error('Ошибка сети:', error);
            alert('Ошибка сети при сохранении');
        }
    }

    // СОХРАНИТЬ СОБЫТИЯ ДЛЯ ВЫБРАННЫХ ДНЕЙ
    async saveMultipleEvents(baseEventData) {
        const baseDate = new Date(baseEventData.date);

        // ДОБАВЛЯЕМ: Устанавливаем created_by для всех событий серии
        if (!this.isEditing) {
            const currentUserId = this.getCurrentUserId();
            if (currentUserId) {
                baseEventData.created_by = Number(currentUserId);
                baseEventData.canEdit = true;
            }
        }

        // Получаем даты для всех выбранных дней на текущей неделе
        const targetDates = this.getDatesForSelectedDays(baseDate);

        // Сохраняем события для всех выбранных дней (включая текущий)
        for (const targetDate of targetDates) {
            // Создаем копию события с новой датой
            const eventForDay = {
                ...baseEventData,
                id: null, // Новое событие
                date: targetDate,
                target_user_id: this.targetUserId
            };

            // Сохраняем событие
            const response = await this.apiService.saveEvent(eventForDay);
            if (response.status === 'success') {
                // Создаем overlay для нового события
                this.overlayManager.createFromData({
                    ...eventForDay,
                    id: response.id
                });
            }
        }
    }

    // ПОЛУЧИТЬ ДАТЫ ДЛЯ ВЫБРАННЫХ ДНЕЙ НА ТЕКУЩЕЙ НЕДЕЛЕ
    getDatesForSelectedDays(baseDate) {
        const daysMap = {
            'mon': 0, 'tue': 1, 'wed': 2,
            'thu': 3, 'fri': 4, 'sat': 5, 'sun': 6
        };

        // Находим понедельник текущей недели
        const monday = new Date(baseDate);
        const dayOfWeek = monday.getDay();
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        monday.setDate(monday.getDate() + diffToMonday);

        const targetDates = [];

        // Для каждого выбранного дня находим дату на текущей неделе
        for (const day of this.selectedDays) {
            const dayIndex = daysMap[day];
            const targetDate = new Date(monday);
            targetDate.setDate(monday.getDate() + dayIndex);

            targetDates.push(targetDate.toISOString().split('T')[0]);
        }

        return targetDates;
    }

    async delete() {
        const eventId = this.elements.eventIdInput.value;

        if (!eventId) {
            console.error('ID события не найден');
            return;
        }

        if (!confirm('Вы уверены, что хотите удалить это событие?')) {
            return;
        }

        try {
            const isRecurring = this.elements.recurringCheckbox.checked;
            const response = await this.apiService.deleteEvent(eventId, isRecurring);

            if (response.status === 'success') {
                this.overlayManager.remove(eventId);
                this.hide();
            } else {
                console.error('Ошибка удаления:', response.message);
                alert('Ошибка удаления: ' + response.message);
            }
        } catch (error) {
            console.error('Ошибка сети:', error);
            alert('Ошибка сети при удалении');
        }
    }

    // Приватные методы
    resetModal() {
        // Сбрасываем цвет
        this.elements.colorOptions.forEach(opt => {
            opt.classList.remove('selected');
        });

        // Сбрасываем скрытое поле ID
        this.elements.eventIdInput.value = '';

        this.selectedDays = []; // Сбрасываем выбранные дни
        this.updateDaysButtonText();

        // Сбрасываем выбранных учеников
        this.selectedStudentIds = [];
        if (this.elements.selectedStudentsList) {
            this.elements.selectedStudentsList.innerHTML = '';
        }

        this.selectedCourseId = null;                                                  
        if (this.elements.courseSelect) this.elements.courseSelect.value = '';         

        if (this.elements.completionGroup) {                                             
            this.elements.completionGroup.style.display = 'none';                         
        }                                                                                 
        if (this.elements.completionSelect) {                                              
            this.elements.completionSelect.value = '';                                     
        }


        
        if (this.elements.attendanceGroup) {                                                
            this.elements.attendanceGroup.style.display = 'none';                           
        }                                                                                    
        this.currentEventData = null;                                                        
    }

    populateEditForm(eventData) {
        // Создаем DTO из полученных данных
        const dto = new EventDTO(eventData);
        // Устанавливаем ID
        this.elements.eventIdInput.value = dto.id;

        // Заполняем поля формы
        this.elements.textInput.value = dto.text;
        this.elements.startMinutesInput.value = dto.getMinutes();
        this.elements.durationInput.value = timeUtils.decimalToTime(dto.duration);
        this.elements.recurringCheckbox.checked = dto.is_recurring;

        // Для редактирования скрываем кнопку выбора дней
        this.elements.selectDaysBtn.style.display = 'none';

        // Восстанавливаем цвет
        if (eventData.color) {
            this.selectColor(dto.color);
        }

        // Если передан overlay, сохраняем его ID
        if (eventData.overlay) {
            this.elements.eventIdInput.value = eventData.overlay.getAttribute('data-id');
        }

        // Восстанавливаем выбранных учеников из события
        // Сервер отдаёт student_ids (массив) и students (объекты с full_name)
        this.selectedStudentIds = Array.isArray(eventData.student_ids) ? [...eventData.student_ids] : [];
        // Если сервер прислал объекты students — обновим кэш, чтобы чипы сразу отрисовались с именами
        if (Array.isArray(eventData.students) && eventData.students.length > 0) {
            eventData.students.forEach(s => {
                if (!this.allStudents.find(x => x.id === s.id)) {
                    this.allStudents.push({ id: s.id, full_name: s.full_name });
                }
            });
        }
        this.renderSelectedStudents();

        if (eventData.course_id) {                                                    
            this.selectedCourseId = eventData.course_id;                                
        } 
        
        // ИЗМЕНЕНО: для группы — кнопка посещаемости, для инда — статус
        const isGroup = eventData.status === 'group';

        // Сохраняем данные события для модалки посещаемости
        this.currentEventData = eventData;

        if (isGroup) {
            // Группа: кнопка «Посещаемость», статус скрыт
            if (this.elements.attendanceGroup) {
                this.elements.attendanceGroup.style.display = 'block';
            }
            if (this.elements.completionGroup) {
                this.elements.completionGroup.style.display = 'none';
            }
        } else if (eventData.completion_status) {
            // Инд с отметкой: показываем статус
            if (this.elements.completionGroup) {
                this.elements.completionGroup.style.display = 'block';
            }
            if (this.elements.completionSelect) {
                this.elements.completionSelect.value = eventData.completion_status;
            }
            if (this.elements.attendanceGroup) {
                this.elements.attendanceGroup.style.display = 'none';
            }
        }
    }

    setupNewEventForm() {
        this.elements.textInput.value = '';
        this.elements.startMinutesInput.value = 0;
        this.elements.recurringCheckbox.checked = false;

        // Устанавливаем цвет по умолчанию
        this.selectColor('blue');

        // Устанавливаем последнюю продолжительность
        this.elements.durationInput.value = storageUtils.getLastDuration();

        // Показываем кнопку выбора дней только для новых событий
        this.elements.selectDaysBtn.style.display = 'inline-block';
        this.updateDaysButtonText();
    }

    selectColor(color) {
        this.elements.colorOptions.forEach(opt => {
            opt.classList.remove('selected');
            if (opt.getAttribute('data-color') === color) {
                opt.classList.add('selected');
            }
        });
        this.selectedColor = color;
    }

    handleColorSelect(option) {
        this.elements.colorOptions.forEach(opt => {
            opt.classList.remove('selected');
        });
        option.classList.add('selected');
        this.selectedColor = option.getAttribute('data-color');
    }

    getFormData() {
        // Базовые данные из формы
        const duration = timeUtils.timeToDecimal(this.elements.durationInput.value);
        const minutes = parseInt(this.elements.startMinutesInput.value) || 0;

        // ✅ ПРАВИЛЬНЫЙ ПОРЯДОК: сначала контекст, потом форма
        const formData = {};

        // ✅ 1. СНАЧАЛА берем КОНТЕКСТ (неизменяемые данные)
        if (this.isEditing && this.currentEvent) {
            // Берем ВСЕ данные из текущего события (контекст)
            Object.assign(formData, this.currentEvent);
            
            // Обновляем время: часы из существующего события + минуты из формы
            const existingDto = new EventDTO(this.currentEvent);
            formData[EVENT_FIELDS.TIME] = `${existingDto.getHours().toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        } 
        // ✅ ДЛЯ НОВОГО СОБЫТИЯ
        else if (this.currentCell) {
            Object.assign(formData, {
                [EVENT_FIELDS.DATE]: this.currentCell.getAttribute('data-date'),
            });

            // Время: часы из ячейки + минуты из формы
            const cellTime = this.currentCell.getAttribute('data-time');
            const cellHours = cellTime.split(':')[0];
            formData[EVENT_FIELDS.TIME] = `${cellHours}:${minutes.toString().padStart(2, '0')}`;

            // Устанавливаем created_by из текущего пользователя
            const currentUserId = this.getCurrentUserId();
            if (currentUserId) {
                formData[EVENT_FIELDS.CREATED_BY] = Number(currentUserId);
            }
        }

        // ✅ 2. ПОТОМ перезаписываем ДАННЫЕ ИЗ ФОРМЫ (изменяемые пользователем)
        Object.assign(formData, {
            [EVENT_FIELDS.ID]: this.elements.eventIdInput.value || null,
            [EVENT_FIELDS.TEXT]: this.elements.textInput.value,
            [EVENT_FIELDS.COLOR]: this.selectedColor || 'blue',
            [EVENT_FIELDS.IS_RECURRING]: this.elements.recurringCheckbox.checked,
            [EVENT_FIELDS.DURATION]: duration,
            [EVENT_FIELDS.START_MINUTES]: minutes,
            course_id: this.selectedCourseId,   // ДОБАВЛЕНО
            completion_status: this.elements.completionSelect?.value || '',   // ДОБАВЛЕНО
        });

        // ✅ ДОБАВЛЯЕМ target_user_id ДЛЯ СОЗДАНИЯ В ЧУЖОМ РАСПИСАНИИ
        if (!this.isEditing && this.targetUserId) {
            formData.target_user_id = this.targetUserId;
        }

        // console.log('📋 GET FORM DATA - final formData:', formData);

        // ДОБАВЛЕНО: если есть ученики — курс обязателен
        if (this.selectedStudentIds.length > 0 && !this.selectedCourseId) {
            alert('Выберите курс для занятия с учениками');
            return null;   // нужно будет обработать в save()
        }

        // ✅ ИСПОЛЬЗУЕМ DTO ДЛЯ АВТОМАТИЧЕСКОЙ ПОДГОТОВКИ ДАННЫХ
        const dto = new EventDTO(formData);
        const apiData = dto.toApiFormat();

        // ✅ Добавляем student_ids напрямую, минуя DTO
        // (student_ids нет в EVENT_STRUCTURE, но сервер его ждёт)
        apiData.student_ids = this.selectedStudentIds || [];

        return apiData;
    }

    validateTimeInput(input) {
        return timeUtils.validateTimeInput(input);
    }

    toggleDeleteButton() {
        const hasEvent = this.isEditing; // ← должно быть true при редактировании
        this.elements.deleteButton.style.display = hasEvent ? 'inline-block' : 'none';
    }

    toggleMoveButton() {
        const hasEvent = this.isEditing; // ← должно быть true при редактировании
        this.elements.moveButton.style.display = hasEvent ? 'inline-block' : 'none';
    }


    /* =====================================================
   Модальное окно выбора учеников
   ===================================================== */

    async showStudentsModal() {
        // Открываем окно
        if (this.elements.studentsModal) this.elements.studentsModal.style.display = 'block';
        if (this.elements.studentsOverlay) this.elements.studentsOverlay.style.display = 'block';

        // Загружаем список учеников
        await this.loadStudentsList();
    }

    hideStudentsModal() {
        if (this.elements.studentsModal) this.elements.studentsModal.style.display = 'none';
        if (this.elements.studentsOverlay) this.elements.studentsOverlay.style.display = 'none';
    }

    async loadStudentsList() {
        const container = this.elements.studentsList;
        if (!container) return;

        // Показываем "загрузка..."
        container.innerHTML = '<div class="event-students-loading">Загрузка...</div>';

        try {
            const response = await fetch('/api/load-students/', {
                method: 'GET',
                cache: 'no-store',
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            const data = await response.json();

            if (data.status === 'success') {
                this.allStudents = data.students; 
                this.renderStudentCheckboxes(data.students);
            } else {
                container.innerHTML = `<div class="event-students-error">${data.message || 'Ошибка загрузки'}</div>`;
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки учеников:', error);
            container.innerHTML = '<div class="event-students-error">Ошибка сети</div>';
        }
    }

    renderStudentCheckboxes(students) {
        const container = this.elements.studentsList;
        if (!container) return;

        if (!students || students.length === 0) {
            container.innerHTML = '<div class="event-students-empty">Пока нет добавленных учеников</div>';
            return;
        }

        // Рендерим строки: имя слева, чекбокс справа
        container.innerHTML = students.map(s => {
            // Проверяем, выбран ли этот ученик ранее
            const checked = this.selectedStudentIds.includes(s.id) ? 'checked' : '';
            return `
                <label class="event-student-row">
                    <span class="event-student-name">${this.escapeHtml(s.full_name)}</span>
                    <input type="checkbox" value="${s.id}" ${checked}>
                </label>
            `;
        }).join('');
    }

    /**
     * Собирает выбранные чекбоксы, сохраняет ID, рендерит чипы, закрывает модалку
     */
    applySelectedStudents() {
        const container = this.elements.studentsList;
        if (!container) return;

        const checked = container.querySelectorAll('input[type="checkbox"]:checked');
        this.selectedStudentIds = Array.from(checked).map(cb => parseInt(cb.value, 10));

        this.renderSelectedStudents();
        this.hideStudentsModal();
    }
    /**
     * Рендерит список выбранных учеников в основной модалке
     * (простой скроллируемый список без кнопок удаления)
     */
    renderSelectedStudents() {
        const container = this.elements.selectedStudentsList;
        if (!container) return;

        if (this.selectedStudentIds.length === 0) {
            container.innerHTML = '';
            this.updateModalText();
            return;
        }

        container.innerHTML = this.selectedStudentIds.map(id => {
            const student = this.allStudents.find(s => s.id === id);
            const name = student ? student.full_name : `ID ${id}`;
            return `
                <a class="selected-student-row"
                href="/students/${id}/"
                title="Открыть профиль">${this.escapeHtml(name)}</a>
            `;
        }).join('');

        this.updateModalText();
        this.updateCourseVisibility();   // ДОБАВЛЕНО
    }

    /**
     * Обновляет заголовок и placeholder в зависимости от наличия учеников
     */
    updateModalText() {
        const hasStudents = this.selectedStudentIds.length > 0;
        const action = this.isEditing ? 'Редактировать' : 'Добавить';
        const object = hasStudents ? 'занятие' : 'событие';

        if (this.elements.modalTitle) {
            this.elements.modalTitle.textContent = `${action} ${object}`;
        }
        if (this.elements.textInput) {
            this.elements.textInput.placeholder = hasStudents
                ? 'Заметка к занятию'
                : 'Введите текст события';
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
        for (const cookie of cookies) {
            const trimmed = cookie.trim();
            if (trimmed.startsWith(name + '=')) {
                return decodeURIComponent(trimmed.substring(name.length + 1));
            }
        }
        return '';
    }

    showModal() {
        this.elements.modal.style.display = 'block';
        this.elements.overlay.style.display = 'block';
    }


    // выбор курса
     async loadCoursesForEvent() {
        if (!this.elements.courseSelect) return;
        this.elements.courseSelect.innerHTML = '<option value="" disabled selected>— Выберите курс —</option>';
        try {
            const response = await fetch('/api/load-courses/', {
                cache: 'no-store',
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            const data = await response.json();
            if (data.status === 'success') {
                this._loadedCourses = data.courses;
                this.renderCourseOptions(data.courses);
            }
        } catch (error) {
            console.error('❌ Ошибка load-courses:', error);
        }
    }

    renderCourseOptions(courses) {
        const options = courses.map(c =>
            `<option value="${c.id}">${this.escapeHtml(c.name)}</option>`
        ).join('');
        const deleteOption = courses.length > 0
            ? '<option value="__delete__">— Удалить курс —</option>'
            : '';
        this.elements.courseSelect.innerHTML = `
            <option value="" disabled selected>— Выберите курс —</option>
            ${options}
            <option value="__add_new__">+ Добавить курс</option>
            ${deleteOption}
        `;
        if (this.selectedCourseId) {
            this.elements.courseSelect.value = String(this.selectedCourseId);
        }
    }

    onCourseCreated(created) {
        const option = document.createElement('option');
        option.value = created.id;
        option.textContent = created.name;
        const addNewOption = this.elements.courseSelect.querySelector('option[value="__add_new__"]');
        if (addNewOption) this.elements.courseSelect.insertBefore(option, addNewOption);
        else this.elements.courseSelect.appendChild(option);
        this._loadedCourses.push({ id: created.id, name: created.name });
        this.elements.courseSelect.value = created.id;
        this.selectedCourseId = created.id;
    }

    onCourseDeleted(deletedId, mode) {
        this._loadedCourses = this._loadedCourses.filter(c => c.id !== deletedId);
        if (this.selectedCourseId === deletedId) this.selectedCourseId = null;
        this.renderCourseOptions(this._loadedCourses);
    }

    updateCourseVisibility() {
        if (!this.elements.courseGroup) return;
        const hasStudents = this.selectedStudentIds.length > 0;
        this.elements.courseGroup.style.display = hasStudents ? 'block' : 'none';
        if (!hasStudents) {
            if (this.elements.courseSelect) this.elements.courseSelect.value = '';
            this.selectedCourseId = null;
        }
    }


    openAttendanceModal() {
        if (!this.currentEventData || !this.elements.attendanceList) return;

        const students = this.currentEventData.students || [];
        if (students.length === 0) {
            this.elements.attendanceList.innerHTML = '<div class="empty-state">Нет учеников</div>';
        } else {
            this.elements.attendanceList.innerHTML = students.map(s => {
                const checked = s.was_present === true ? 'checked' : '';
                // ДОБАВЛЕНО: суффикс с оставшимися оплатами
                const suffix = (s.remaining_lessons !== null && s.remaining_lessons !== undefined)
                    ? ` (${s.remaining_lessons})`
                    : '';
                return `
                    <label class="attendance-row">
                        <input type="checkbox" value="${s.id}" ${checked}>
                        <span class="attendance-name">${this.escapeHtml(s.full_name)}${suffix}</span>
                    </label>
                `;
            }).join('');
        }

        if (this.elements.attendanceModal) this.elements.attendanceModal.classList.add('active');
        if (this.elements.attendanceOverlay) this.elements.attendanceOverlay.classList.add('active');
    }

    closeAttendanceModal() {
        if (this.elements.attendanceModal) this.elements.attendanceModal.classList.remove('active');
        if (this.elements.attendanceOverlay) this.elements.attendanceOverlay.classList.remove('active');
    }

    async handleAttendanceSave() {
        if (!this.currentEventData) return;

        const eventId = this.currentEventData.id;
        const checkboxes = this.elements.attendanceList.querySelectorAll('input[type="checkbox"]');
        const attendances = Array.from(checkboxes).map(cb => ({
            student_id: parseInt(cb.value, 10),
            was_present: cb.checked,
        }));

        this.elements.attendanceSave.disabled = true;
        this.elements.attendanceSave.textContent = 'Сохранение...';

        try {
            const response = await fetch('/api/mark-event/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken(),
                },
                body: JSON.stringify({ id: eventId, attendances }),
            });
            const data = await response.json();
            console.log('📥 Ответ mark-event (группа):', data);

            if (data.status === 'success') {
                this.closeAttendanceModal();
                this.hide();
                // Перезагружаем события недели, чтобы обновить счётчики на карточках
                if (this.eventManager && this.eventManager.loadEventsForWeek) {
                    this.eventManager.loadEventsForWeek();
                }
            } else {
                alert('Ошибка: ' + (data.message || 'не удалось сохранить'));
            }
        } catch (error) {
            console.error('❌ Ошибка mark-event:', error);
            alert('Ошибка сети');
        } finally {
            this.elements.attendanceSave.disabled = false;
            this.elements.attendanceSave.textContent = 'Сохранить';
        }
    }
}