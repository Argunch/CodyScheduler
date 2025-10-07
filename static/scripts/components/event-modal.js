import { timeUtils, dateUtils, storageUtils } from '../utils/utils.js';

import { EventDTO } from '../models/event-dto.js';
import { EVENT_FIELDS } from '../constants/event-fields.js';

export class EventModal {
    constructor(apiService, overlayManager) {
        this.apiService = apiService;
        this.overlayManager = overlayManager;

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

            // Элементы модального окна выбора дня недели
            daysModal: document.getElementById('days-modal'),
            daysOverlay: document.getElementById('days-modal-overlay'),
            daysCheckboxes: document.querySelectorAll('.days-checkboxes input'),
            daysModalOk: document.getElementById('days-modal-ok'),
            daysModalCancel: document.getElementById('days-modal-cancel')
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

    show(eventData=null,cell=null) {
        this.currentCell = cell;
        this.selectedColor = null;
        this.isEditing = !!eventData;

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
        this.showModal();
        this.elements.textInput.focus();
    }

    hide() {
        this.elements.modal.style.display = 'none';
        this.elements.overlay.style.display = 'none';
        this.currentCell = null;
        this.isEditing = false;
    }

    async save() {
        const eventData = this.getFormData();

        // Используем валидацию из DTO
        const dto = new EventDTO(eventData);
        const validationErrors = dto.validate();

        if (validationErrors.length > 0) {
            alert(validationErrors.join('\n'));
            return;
        }

        // Сохраняем продолжительность
        storageUtils.saveLastDuration(this.elements.durationInput.value);
        
        try {
            // ЕСЛИ ВЫБРАНЫ ДНИ - создаем события для каждого дня
            if (this.selectedDays.length > 0) {
                await this.saveMultipleEvents(eventData);
            } else {
                // ОДИНОЧНОЕ СОБЫТИЕ
                const response = await this.apiService.saveEvent(eventData);
                if (response.status === 'success') {
                    // УДАЛяем СТАРЫЙ OVERLAY ПЕРЕД СОЗДАНИЕМ НОВОГО
                    if (this.isEditing && eventData.id) {
                        this.overlayManager.remove(eventData.id);
                    }

                    // Создаем новый overlay
                    this.overlayManager.createFromData({
                        ...eventData,
                        id: response.id
                    });


                } else {
                    console.error('Ошибка сохранения:', response.message);
                    alert('Ошибка сохранения: ' + response.message);
                }
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

        // Получаем даты для всех выбранных дней на текущей неделе
        const targetDates = this.getDatesForSelectedDays(baseDate);

        // Сохраняем события для всех выбранных дней (включая текущий)
        for (const targetDate of targetDates) {
            // Создаем копию события с новой датой
            const eventForDay = {
                ...baseEventData,
                id: null, // Новое событие
                date: targetDate
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
        const duration = timeUtils.timeToDecimal(this.elements.durationInput.value);
        const minutes = parseInt(this.elements.startMinutesInput.value) || 0;

        const formData = {
            [EVENT_FIELDS.ID]: this.elements.eventIdInput.value || null,
            [EVENT_FIELDS.TEXT]: this.elements.textInput.value,
            [EVENT_FIELDS.COLOR]: this.selectedColor || 'blue',
            [EVENT_FIELDS.IS_RECURRING]: this.elements.recurringCheckbox.checked,
            [EVENT_FIELDS.DURATION]: duration,
            [EVENT_FIELDS.START_MINUTES]: parseInt(this.elements.startMinutesInput.value) || 0
        };

        if (this.isEditing) {
            // При редактировании - берем из данных события
            const eventData = this.getEventDataFromCurrentForm();
            formData[EVENT_FIELDS.DATE] = eventData.date;

            const existingDto = new EventDTO(eventData);
            // Формируем полное время из часов существующего события + минут из формы
            formData[EVENT_FIELDS.TIME] = `${existingDto.getHours().toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;;
        } else if (this.currentCell) {
            // При создании нового - берем из ячейки
            formData[EVENT_FIELDS.DATE] = this.currentCell.getAttribute('data-date');

            // Для нового события: берем часы из ячейки + минуты из формы
            const cellTime = this.currentCell.getAttribute('data-time'); // "08:00"
            const cellHours = cellTime.split(':')[0];
            formData[EVENT_FIELDS.TIME] = `${cellHours}:${minutes.toString().padStart(2, '0')}`;
        }

        const dto = new EventDTO(formData);
        return dto.toApiFormat();
    }

    // Дополнительный метод для получения данных события из текущей формы
    getEventDataFromCurrentForm() {
        // Получаем базовые данные из атрибутов модального окна или из сохраненных данных
        if (this.elements.eventIdInput.value) {
            // Если есть ID, пытаемся найти существующий overlay
            const existingOverlay = document.querySelector(`.event-item[data-id="${this.elements.eventIdInput.value}"]`);
            if (existingOverlay) {
                return {
                    date: existingOverlay.getAttribute('data-date'),
                    time: existingOverlay.getAttribute('data-time')
                };
            }
        }
    }

    validateTimeInput(input) {
        return timeUtils.validateTimeInput(input);
    }

    toggleDeleteButton() {
        const hasEvent = this.isEditing; // ← должно быть true при редактировании
        this.elements.deleteButton.style.display = hasEvent ? 'inline-block' : 'none';
    }

    showModal() {
        this.elements.modal.style.display = 'block';
        this.elements.overlay.style.display = 'block';
    }
}