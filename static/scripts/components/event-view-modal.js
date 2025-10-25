import { timeUtils, dateUtils } from '../utils/utils.js';
import { EventDTO } from '../models/event-dto.js';

export class EventViewModal {
    constructor() {
        this.elements = {
            modal: document.getElementById('event-view-modal'),
            overlay: document.getElementById('view-modal-overlay'),
            timeInfo: document.getElementById('view-time-info'),
            eventText: document.getElementById('view-event-text'),
            eventDuration: document.getElementById('view-event-duration'),
            close: document.querySelector('#event-view-modal .close')
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

        // ДОБАВЛЯЕМ: Обработчик для крестика
        if (this.elements.close) {
            this.elements.close.addEventListener('click', () => this.hide());
        }

        // Закрытие по клику на overlay
        this.elements.overlay.addEventListener('click', () => this.hide());

        // Закрытие по ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible()) {
                this.hide();
            }
        });

        // Предотвращаем закрытие при клике на само модальное окно
        this.elements.modal.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    /**
     * Показать модальное окно для просмотра события
     * @param {Object} eventData - Данные события
     */
    show(eventData) {
        const dto = new EventDTO(eventData);

        // Форматируем дату и время
        const date = dto.date;
        const time = dto.time;
        const day = dateUtils.getDayFromDate(date);
        const formattedDate = dateUtils.formatDate(date);

        // Устанавливаем информацию о времени
        this.elements.timeInfo.textContent =
            `${this.dayNames[day]}, ${formattedDate} ${time}`;

        // Заполняем поля
        this.elements.eventText.textContent = dto.text || '(без текста)';
        this.elements.eventDuration.textContent =
            `${timeUtils.decimalToTime(dto.duration)} часов`;

        this.showModal();
    }

    /**
     * Показать модальное окно
     */
    showModal() {
        this.elements.modal.style.display = 'block';
        this.elements.overlay.style.display = 'block';
    }

    /**
     * Скрыть модальное окно
     */
    hide() {
        this.elements.modal.style.display = 'none';
        this.elements.overlay.style.display = 'none';
    }

    /**
     * Проверить, видимо ли модальное окно
     */
    isVisible() {
        return this.elements.modal.style.display === 'block';
    }
}