import { EVENT_FIELDS, EVENT_STRUCTURE, DATA_ATTRIBUTES } from '../constants/event-fields.js';

export class EventDTO {
    constructor(data = {}) {
        Object.keys(EVENT_STRUCTURE).forEach(key => {
            this[key] = data[key] ?? EVENT_STRUCTURE[key];
        });
        
        this._calculateCanEdit(data);
    }

    _calculateCanEdit(data) {
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
    }

    getCurrentUserId() {
        const userElement = document.querySelector('[data-user-id]');
        return userElement ? userElement.dataset.userId : '';
    }

    toApiFormat() {
        // Автоматически собираем все поля для API
        const apiData = {};
        
        Object.keys(this).forEach(key => {
            // Исключаем внутренние поля, которые не нужно отправлять на сервер
            if (!['overlay', 'canEdit'].includes(key)) {
                apiData[key] = this[key];
            }
        });
        
        return apiData;
    }

    static prepareForApi(eventData) {
        const processed = { ...eventData };

        // ✅ ОЧИСТКА UUID ПЕРЕД ОБРАБОТКОЙ (МИНИМАЛЬНОЕ ИЗМЕНЕНИЕ)
        if (processed.id && typeof processed.id === 'string') {
            processed.id = processed.id.replace(/["'“”]/g, '').trim();
        }
        if (processed.series_id && typeof processed.series_id === 'string') {
            processed.series_id = processed.series_id.replace(/["'“”]/g, '').trim();
            // Если после очистки строка пустая, устанавливаем null
            if (processed.series_id === '') {
                processed.series_id = null;
            }
        }
        
        // ✅ ДЛЯ РЕГУЛЯРНЫХ СОБЫТИЙ: series_id должен быть null
        // Сервер сам сгенерирует валидный UUID
        if (processed.is_recurring && !processed.series_id) {
            processed.series_id = null; // ← важно оставить null для регулярных
        }
        
        // ✅ Удаление series_id для нерегулярных
        if (!processed.is_recurring) {
            delete processed.series_id;
        }
        
        // ❌ НЕ УДАЛЯЕМ null значения для series_id!
        // Очистка null значений только для некоторых полей
        Object.keys(processed).forEach(key => {
            // Не очищаем series_id если он null - это важно для регулярных событий
            if (key !== 'series_id' && processed[key] === null) {
                delete processed[key];
            }
        });
        
        // console.log('🔧 Prepared for API:', processed);
        return processed;
    }

    static generateSeriesId() {
        return 'series_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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

    /**
     * Объединить данные с ответом сервера
     * @param {Object} frontendData - Данные с фронтенда
     * @param {Object} serverResponse - Ответ сервера
     * @returns {EventDTO}
     */
    static mergeWithResponse(frontendData, serverResponse) {
        if (serverResponse.status !== 'success') {
            return new EventDTO(frontendData);
        }
        
        // Копируем ВСЕ поля из ответа сервера (кроме служебных)
        const { status, message, created, ...serverData } = serverResponse;
        
        const mergedData = {
            ...frontendData,
            ...serverData,
            id: serverResponse.id
        };
        
        return new EventDTO(mergedData);
    }

}


// Проверь работу:
// Создай событие - проверь что canEdit вычисляется правильно

// Кликни на overlay - проверь что canEdit извлекается из data-атрибутов

// Проверь консоль - нет ли ошибок

// Теперь должно работать! 🚀
// _calculateCanEdit(data) {
//     // ПРОСТАЯ ЛОГИКА: если canEdit явно передан - используем его
//     if (data.canEdit !== undefined) {
//         this.canEdit = Boolean(data.canEdit);
//         return;
//     }
    
//     // Иначе вычисляем
//     this.canEdit = this.created_by && 
//                   this.created_by.toString() === this.getCurrentUserId();
// }
