import { EVENT_FIELDS, EVENT_DEFAULTS, DATA_ATTRIBUTES } from '../constants/event-fields.js';

export class EventDTO {
    constructor(data) {
        this.id = data.id;
        this.date = data.date;
        this.time = data.time;
        this.text = data.text || '';
        this.color = data.color || EVENT_DEFAULTS.COLOR;
        this.is_recurring = data.is_recurring ?? EVENT_DEFAULTS.IS_RECURRING;
        this.duration = data.duration ?? EVENT_DEFAULTS.DURATION;
        this.created_by = data[EVENT_FIELDS.CREATED_BY] || null; // ← ДОБАВЛЕНО
        this.user_id = data.user_id || null;

        // УЛУЧШЕННАЯ ЛОГИКА: проверяем разные источники данных
        if (data[EVENT_FIELDS.CAN_EDIT] !== undefined) {
            this.canEdit = data[EVENT_FIELDS.CAN_EDIT];
        } else if (data[DATA_ATTRIBUTES.CAN_EDIT] !== undefined) {
            // Если данные пришли из data-атрибутов overlay
            this.canEdit = data[DATA_ATTRIBUTES.CAN_EDIT] === 'true';
        } else {
            // Вычисляем по умолчанию
            this.canEdit = this.created_by && this.created_by.toString() === this.getCurrentUserId();
        }
        this.target_user_id = data.target_user_id || null;
    }

    // Добавьте метод для получения текущего пользователя
    getCurrentUserId() {
        const userElement = document.querySelector('[data-user-id]');
        return userElement ? userElement.dataset.userId : '';
    }


    toApiFormat() {
        const apiData = {
            [EVENT_FIELDS.ID]: this.id,
            [EVENT_FIELDS.DATE]: this.date,
            [EVENT_FIELDS.TIME]: this.time,
            [EVENT_FIELDS.TEXT]: this.text,
            [EVENT_FIELDS.COLOR]: this.color,
            [EVENT_FIELDS.IS_RECURRING]: this.is_recurring,
            [EVENT_FIELDS.DURATION]: this.duration,
        };

        // ДОБАВЛЯЕМ: Передаем target_user_id если он есть
        if (this.target_user_id) {
            apiData.target_user_id = this.target_user_id; // ← отдельное поле
        }

        return apiData;
    }

    // Добавляем метод для получения минут
    getMinutes() {
        const [hours, minutes] = this.time.split(':');
        return parseInt(minutes) || 0;
    }

    // Метод для получения часов
    getHours() {
        const [hours, minutes] = this.time.split(':');
        return parseInt(hours) || 0;
    }

    validate() {
        const errors = [];

        // Валидация минут
        if (this.getMinutes() < 0 || this.getMinutes() > 55) {
            errors.push('Минуты должны быть от 0 до 55');
        }

        // Валидация продолжительности
        if (this.duration <= 0) {
            errors.push('Продолжительность должна быть больше 0');
        }

        // Валидация времени
        if (!this.time || !this.time.includes(':')) {
            errors.push('Неверный формат времени');
        }

        return errors;
    }

    isValid() {
        return this.validate().length === 0;
    }
}