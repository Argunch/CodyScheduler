import { timeUtils, dateUtils, storageUtils } from '../utils/utils.js';

import { EventDTO } from '../models/event-dto.js';
import { EVENT_FIELDS } from '../constants/event-fields.js';

export class EventModal {
    constructor(apiService, overlayManager,eventManager) {
        this.apiService = apiService;
        this.overlayManager = overlayManager;
        this.eventManager = eventManager;

        this.currentCell = null;
        this.selectedColor = null;
        this.isEditing = false;

        this.elements = {
            modal: document.getElementById('event-modal'),
            overlay: document.getElementById('modal-overlay'),
            timeInfo: document.getElementById('modal-time-info'),
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
            moveModalCancel: document.getElementById('move-modal-cancel')
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

    show(eventData=null,cell=null, targetUserId = null) {
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
        });

        // ✅ ДОБАВЛЯЕМ target_user_id ДЛЯ СОЗДАНИЯ В ЧУЖОМ РАСПИСАНИИ
        if (!this.isEditing && this.targetUserId) {
            formData.target_user_id = this.targetUserId;
        }

        // console.log('📋 GET FORM DATA - final formData:', formData);

        // ✅ ИСПОЛЬЗУЕМ DTO ДЛЯ АВТОМАТИЧЕСКОЙ ПОДГОТОВКИ ДАННЫХ
        const dto = new EventDTO(formData);
        return dto.toApiFormat();
    }

    // buildBaseFormData() {
    //     const duration = timeUtils.timeToDecimal(this.elements.durationInput.value);
    //     const minutes = parseInt(this.elements.startMinutesInput.value) || 0;

    //     return {
    //         [EVENT_FIELDS.ID]: this.elements.eventIdInput.value || null,
    //         [EVENT_FIELDS.TEXT]: this.elements.textInput.value,
    //         [EVENT_FIELDS.COLOR]: this.selectedColor || 'blue',
    //         [EVENT_FIELDS.IS_RECURRING]: this.elements.recurringCheckbox.checked,
    //         [EVENT_FIELDS.DURATION]: duration,
    //         [EVENT_FIELDS.START_MINUTES]: minutes,
    //         [EVENT_FIELDS.CREATED_BY]: this.getCreatedByValue(),
    //         target_user_id: this.getTargetUserId()
    //     };
    // }

    // getCreatedByValue() {
    //     if (this.isEditing && this.currentEvent?.created_by) {
    //         return this.currentEvent.created_by;
    //     }
        
    //     const currentUserId = this.getCurrentUserId();
    //     return currentUserId ? Number(currentUserId) : null;
    // }

    // getTargetUserId() {
    //     return (!this.isEditing && this.targetUserId) ? this.targetUserId : null;
    // }

    // getFormData() {
    //     const formData = this.buildBaseFormData();
        
    //     if (this.isEditing && this.currentEvent) {
    //         Object.assign(formData, this.currentEvent);
    //         this.updateTimeForEditing(formData);
    //     } else if (this.currentCell) {
    //         this.setNewEventData(formData);
    //     }

    //     console.log('📋 GET FORM DATA - final formData:', formData);
    //     return new EventDTO(formData).toApiFormat();
    // }

    // /**
    //  * Обновляет время для редактируемого события
    //  * Сохраняет часы из существующего события + минуты из формы
    //  */
    // updateTimeForEditing(formData) {
    //     const minutes = formData[EVENT_FIELDS.START_MINUTES] || 0;
        
    //     // Берем часы из существующего события
    //     const existingDto = new EventDTO(this.currentEvent);
    //     const hours = existingDto.getHours();
        
    //     // Формируем полное время: часы из события + минуты из формы
    //     formData[EVENT_FIELDS.TIME] = 
    //         `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    // }

    // /**
    //  * Устанавливает данные для нового события
    //  * Берет дату и время из ячейки, устанавливает контекст
    //  */
    // setNewEventData(formData) {
    //     // Устанавливаем дату из ячейки
    //     formData[EVENT_FIELDS.DATE] = this.currentCell.getAttribute('data-date');
        
    //     // Формируем время: часы из ячейки + минуты из формы
    //     const minutes = formData[EVENT_FIELDS.START_MINUTES] || 0;
    //     const cellTime = this.currentCell.getAttribute('data-time'); // "08:00"
    //     const cellHours = cellTime.split(':')[0];
        
    //     formData[EVENT_FIELDS.TIME] = 
    //         `${cellHours}:${minutes.toString().padStart(2, '0')}`;
        
    //     // Устанавливаем target_user_id если создаем в чужом расписании
    //     if (this.targetUserId) {
    //         formData.target_user_id = this.targetUserId;
    //     }
    // }

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

    showModal() {
        this.elements.modal.style.display = 'block';
        this.elements.overlay.style.display = 'block';
    }
}