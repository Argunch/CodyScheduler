import { EventDTO } from '../models/event-dto.js';

export class ApiService {
    constructor(baseUrl = '/api') {
        this.baseUrl = baseUrl;
    }

    /**
     * Сохранить событие (создание или редактирование)
     * @param {Object} eventData - Данные события
     * @returns {Promise<Object>} Ответ сервера
     */
    async saveEvent(eventData) {
        try {
            const response = await fetch(`${this.baseUrl}/save-event/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken(),
                },
                body: JSON.stringify(this.prepareEventData(eventData))
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Ошибка при сохранении события:', error);
            throw new Error(`Сетевая ошибка: ${error.message}`);
        }
    }

    /**
     * Удалить событие
     * @param {string} eventId - ID события
     * @param {boolean} deleteRecurring - Удалить всю серию регулярных событий
     * @returns {Promise<Object>} Ответ сервера
     */
    async deleteEvent(eventId, deleteRecurring = false) {
        if (!eventId) {
            throw new Error('ID события обязателен для удаления');
        }

        try {
            const response = await fetch(`${this.baseUrl}/delete-event/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken(),
                },
                body: JSON.stringify({
                    id: eventId,
                    delete_recurring: deleteRecurring
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Ошибка при удалении события:', error);
            throw new Error(`Сетевая ошибка: ${error.message}`);
        }
    }

    /**
     * Загрузить события за период
     * @param {string} dateFrom - Дата начала (YYYY-MM-DD)
     * @param {string} dateTo - Дата окончания (YYYY-MM-DD)
     * @returns {Promise<Array>} Массив событий
     */
    async loadEvents(dateFrom, dateTo) {
        if (!dateFrom || !dateTo) {
            throw new Error('Даты начала и окончания обязательны');
        }

        try {
            const response = await fetch(
                `${this.baseUrl}/load-events/?date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}`,
                {
                    headers: {
                        'X-CSRFToken': this.getCSRFToken(),
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.status === 'success') {
                return data.events;
            } else {
                throw new Error(data.message || 'Ошибка загрузки событий');
            }
        } catch (error) {
            console.error('Ошибка при загрузке событий:', error);
            throw new Error(`Сетевая ошибка: ${error.message}`);
        }
    }

    /**
     * Загрузить события для текущей недели
     * @param {Array} weekDays - Массив дней недели
     * @returns {Promise<Array>} Массив событий
     */
    async loadEventsForWeek(weekDays) {
        if (!weekDays || weekDays.length === 0) {
            console.warn('Не переданы дни недели для загрузки');
            return [];
        }

        const dateFrom = weekDays[0].date;
        const dateTo = weekDays[weekDays.length - 1].date;

        return await this.loadEvents(dateFrom, dateTo);
    }

    /**
     * Получить CSRF токен
     * @returns {string} CSRF токен
     */
    getCSRFToken() {
        const cookieValue = document.cookie
            .split('; ')
            .find(row => row.startsWith('csrftoken='))
            ?.split('=')[1];

        if (!cookieValue) {
            console.warn('CSRF token not found in cookies');
        }

        return cookieValue || '';
    }

    /**
     * Подготовить данные события для отправки
     * @param {Object} eventData - Данные события
     * @returns {Object} Подготовленные данные
     */
    prepareEventData(eventData) {
        const dto = new EventDTO(eventData);
        return dto.toApiFormat();
    }

    /**
     * Проверить соединение с сервером
     * @returns {Promise<boolean>} true если сервер доступен
     */
    async checkConnection() {
        try {
            const response = await fetch(`${this.baseUrl}/load-events/`, {
                method: 'HEAD',
                timeout: 5000
            });
            return response.ok;
        } catch (error) {
            console.warn('Сервер недоступен:', error);
            return false;
        }
    }

    /**
     * Повторить запрос с задержкой (retry logic)
     * @param {Function} requestFn - Функция запроса
     * @param {number} maxRetries - Максимальное количество попыток
     * @param {number} delay - Задержка между попытками (мс)
     * @returns {Promise<Object>} Результат запроса
     */
    async retryRequest(requestFn, maxRetries = 3, delay = 1000) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await requestFn();
            } catch (error) {
                if (attempt === maxRetries) {
                    throw error;
                }

                console.warn(`Попытка ${attempt} не удалась, повтор через ${delay}мс`);
                await this.delay(delay);
                delay *= 2; // Exponential backoff
            }
        }
    }

    /**
     * Задержка выполнения
     * @param {number} ms - Миллисекунды
     * @returns {Promise} Promise который резолвится через указанное время
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}