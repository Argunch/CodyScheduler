import { EVENT_FIELDS, EVENT_DEFAULTS } from '../constants/event-fields.js';

export class EventDTO {
    constructor(data) {
        this.id = data.id;
        this.date = data.date;
        this.time = data.time;
        this.text = data.text || '';
        this.color = data.color || EVENT_DEFAULTS.COLOR;
        this.is_recurring = data.is_recurring ?? EVENT_DEFAULTS.IS_RECURRING;
        this.duration = data.duration ?? EVENT_DEFAULTS.DURATION;
    }

    toApiFormat() {
        return {
            [EVENT_FIELDS.ID]: this.id,
            [EVENT_FIELDS.DATE]: this.date,
            [EVENT_FIELDS.TIME]: this.time,
            [EVENT_FIELDS.TEXT]: this.text,
            [EVENT_FIELDS.COLOR]: this.color,
            [EVENT_FIELDS.IS_RECURRING]: this.is_recurring,
            [EVENT_FIELDS.DURATION]: this.duration,
        };
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