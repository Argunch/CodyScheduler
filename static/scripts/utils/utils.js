import { EventDTO } from '../models/event-dto.js';
import { EVENT_STRUCTURE, DATA_ATTRIBUTE_MAPPING } from '../constants/event-fields.js';

export const eventUtils = {
    /**
     * Создать объект события со значениями по умолчанию
     */
    createEventTemplate(overrides = {}) {
        return { ...EVENT_STRUCTURE, ...overrides };
    },

    /**
     * Извлечь данные события из overlay элемента
     */
    extractEventFromOverlay(overlay) {
        const rawData = { ...EVENT_STRUCTURE };
        
        // Автоматически мапим все data-атрибуты
        Object.entries(DATA_ATTRIBUTE_MAPPING).forEach(([attr, field]) => {
            const value = overlay.getAttribute(attr);
            if (value !== null) {
                rawData[field] = this._convertValue(field, value);
            }
        });
        
        // Текст берем из содержимого
        rawData.text = overlay.textContent || '';
        
        // Overlay - это сам элемент
        rawData.overlay = overlay;
        
        return new EventDTO(rawData);
    },

    /**
     * Нормализовать данные события
     */
    normalizeEvent(eventData) {
        return { ...EVENT_STRUCTURE, ...eventData };
    },

    /**
     * Конвертировать значения из строк в правильные типы
     */
    _convertValue(field, value) {
        if (value === 'true') return true;
        if (value === 'false') return false;
        if (field === 'duration') return parseFloat(value) || EVENT_STRUCTURE.duration;
        if (field === 'is_recurring') return value === 'true';
        if (field === 'canEdit') return value === 'true';
        if (field === 'startMinutes') return parseInt(value) || 0;
        return value;
    }
};

export const dateUtils = {
    formatDate(dateString) {
        if (!dateString) return '';
        const [year, month, day] = dateString.split('-');
        return `${day}.${month}.${year}`;
    },

    getDayFromDate(dateString) {
        const date = new Date(dateString);
        const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        return days[date.getDay()];
    }
};

export const timeUtils = {
    // Функция для преобразования времени в формате "чч:мм" в десятичные часы
    timeToDecimal(timeStr) {
        if (!timeStr) return 1;

        // Если время в формате "1:30" или "2:45"
        if (timeStr.includes(':')) {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours + (minutes / 60);
        }

        // Если только часы "1" или "2"
        return parseFloat(timeStr) || 1;
    },
    // Функция для преобразования десятичных часов в формат "чч:мм"
    decimalToTime(decimalHours) {
        const hours = Math.floor(decimalHours);
        const minutes = Math.round((decimalHours - hours) * 60);

        // Обработка случая, когда minutes = 60
        if (minutes === 60) {
            return `${hours + 1}:00`;
        }

        return `${hours}:${minutes.toString().padStart(2, '0')}`;
    },
    // Функция для валидации ввода времени
    validateTimeInput(input) {
        const value = input.value;

        // Разрешаем пустое значение для редактирования
        if (value === '') return true;

        // Проверяем формат: цифры и двоеточие
        if (!/^\d*:?\d*$/.test(value)) {
            input.setCustomValidity('Используйте формат часы:минуты (например: 1:30)');
            return false;
        }

        // Если есть двоеточие, проверяем части
        if (value.includes(':')) {
            const [hoursStr, minutesStr] = value.split(':');
            const hours = parseInt(hoursStr) || 0;
            const minutes = parseInt(minutesStr) || 0;

            if (minutes > 59) {
                input.setCustomValidity('Минуты не могут быть больше 59');
                return false;
            }

            if (hours > 24) {
                input.setCustomValidity('Часы не могут быть больше 24');
                return false;
            }
        }

        input.setCustomValidity('');
        return true;
    },
    toBaseTime(time) {
        if (!time) return '00:00';
        // Используем DTO для получения часов
        const tempDto = new EventDTO({ time });
        return `${tempDto.getHours().toString().padStart(2, '0')}:00`;
    }
};

export const domUtils = {
    // Функция для расчета позиции overlay
    calculateEventPosition(cell, durationHours = 1, time = '00:00') {
        const cellRect = cell.getBoundingClientRect();
        const containerRect = cell.closest('.schedule-container').getBoundingClientRect();

        const dto = new EventDTO({ time });
        const minutes = dto.getMinutes();

        const top = (cellRect.top - containerRect.top) +
                (cellRect.height / 60) * minutes;
        const left = cell.offsetLeft;
        const width = cell.offsetWidth*0.9;
        const height = cell.offsetHeight * durationHours;

        return {
            top,
            left,
            width,
            height,
            time: dto.getHours(),
            date: cell.getAttribute('data-date')
        };
    },
    findCellByDateTime(date, time) {
        // Используем утилиту для преобразования в базовое время
        const baseTime = timeUtils.toBaseTime(time);
        return document.querySelector(
            `.schedule-cell[data-date="${date}"][data-time="${baseTime}"]`
        );
    }
};

export const storageUtils = {
    // Сохранение последней продолжительности
    saveLastDuration(duration) {
        localStorage.setItem('lastDuration', duration);
    },
    // Получение последней продолжительности
    getLastDuration() {
        return localStorage.getItem('lastDuration') || '1:00'; // Значение по умолчанию
    }
};