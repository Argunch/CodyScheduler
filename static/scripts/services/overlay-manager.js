import { domUtils } from '../utils/utils.js';
import { EventDTO } from '../models/event-dto.js';
import { EVENT_FIELDS, DATA_ATTRIBUTES, EVENT_DEFAULTS} from '../constants/event-fields.js';

export class OverlayManager {
    constructor() {
        this.overlaysContainer = document.getElementById('events-overlay');
        this.overlays = new Map(); // Храним overlay по ID для быстрого доступа
        this.setupContainer();
    }

    /**
     * Настроить контейнер для overlay
     */
    setupContainer() {
        if (!this.overlaysContainer) {
            console.error('Контейнер events-overlay не найден');
            return;
        }

        // Обеспечиваем правильное позиционирование
        this.overlaysContainer.style.position = 'relative';
    }

        /**
     * Найти ячейку для event'a
     * @param {Object} eventData - Данные события
     * @returns {HTMLElement} cell - Ячейка расписания
     */
    createFromData(eventData) {
        const cell = this.findCellForEvent(eventData);
        if (!cell) {
            console.warn('Ячейка не найдена для события:', eventData);
            return null;
        }

        return this.create(cell, eventData);
    }

    findCellForEvent(eventData) {
        const dto = new EventDTO(eventData);
        const baseTime = `${dto.getHours().toString().padStart(2, '0')}:00`;

        return document.querySelector(
            `.schedule-cell[data-date="${eventData.date}"][data-time="${baseTime}"]`
        );
    }

    /**
     * Создать overlay события
     * @param {HTMLElement} cell - Ячейка расписания
     * @param {Object} eventData - Данные события
     * @returns {HTMLElement} Созданный overlay элемент
     */

    create(cell, eventData) {
        if (!cell || !eventData) {
            console.error('Не переданы cell или eventData');
            return null;
        }

        const position = domUtils.calculateEventPosition(
            cell,
            eventData.duration,
            eventData.time
        );

        const overlay = this.createOverlayElement(eventData, position);
        this.addOverlayToContainer(overlay);
        this.registerOverlay(eventData.id, overlay);

        this.setupOverlayEvents(overlay, eventData);

        return overlay;
    }

    /**
     * Создать DOM элемент overlay
     * @param {Object} eventData - Данные события
     * @param {Object} position - Позиция и размеры
     * @returns {HTMLElement} Overlay элемент
     */
    createOverlayElement(eventData, position) {
        const overlay = document.createElement('div');
        overlay.className = `event-item ${eventData.color || 'blue'}`;

        // Устанавливаем стили
        Object.assign(overlay.style, {
            top: `${position.top}px`,
            left: `${position.left}px`,
            width: `${position.width}px`,
            height: `${position.height}px`,
            position: 'absolute'
        });

        overlay.textContent = eventData.text || '';

        // Устанавливаем data атрибуты
        this.setOverlayAttributes(overlay, eventData);

        // Добавляем класс для коротких событий
        if (eventData.duration < 1.5) {
            overlay.classList.add('short');
        }

        return overlay;
    }

    /**
     * Установить data атрибуты для overlay
     * @param {HTMLElement} overlay - Overlay элемент
     * @param {Object} eventData - Данные события
     */
    setOverlayAttributes(overlay, eventData) {
        const dto=new EventDTO(eventData);

        const attributes = {
            [DATA_ATTRIBUTES.ID]: dto.id,
            [DATA_ATTRIBUTES.TIME]: dto.time,
            [DATA_ATTRIBUTES.DATE]: dto.date,
            [DATA_ATTRIBUTES.DURATION]: dto.duration,
            [DATA_ATTRIBUTES.COLOR]: dto.color,
            [DATA_ATTRIBUTES.RECURRING]: dto.is_recurring
        };

        Object.entries(attributes).forEach(([key, value]) => {
            overlay.setAttribute(key, value);
        });
    }

    /**
     * Извлечь время из данных события
     * @param {Object} eventData - Данные события
     * @returns {number} Время в часах
     */
    extractTimeFromCell(eventData) {
        // Если время передано в формате "HH:MM", извлекаем часы
        if (eventData.time && eventData.time.includes(':')) {
            return parseInt(eventData.time.split(':')[0]);
        }
        return parseInt(eventData.time) || 0;
    }

    /**
     * Добавить overlay в контейнер
     * @param {HTMLElement} overlay - Overlay элемент
     */
    addOverlayToContainer(overlay) {
        if (this.overlaysContainer) {
            this.overlaysContainer.appendChild(overlay);
        } else {
            console.error('Контейнер overlay не найден');
        }
    }

    /**
     * Зарегистрировать overlay в менеджере
     * @param {string} eventId - ID события
     * @param {HTMLElement} overlay - Overlay элемент
     */
    registerOverlay(eventId, overlay) {
        if (eventId) {
            this.overlays.set(eventId, overlay);
        }
    }

    /**
     * Настроить обработчики событий для overlay
     * @param {HTMLElement} overlay - Overlay элемент
     * @param {Object} eventData - Данные события
     */
    setupOverlayEvents(overlay, eventData) {
        // Обработчик клика для редактирования
        overlay.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleOverlayClick(overlay, eventData);
        });

        // Дополнительные события можно добавить здесь
        overlay.addEventListener('mouseenter', () => {
            this.handleOverlayHover(overlay, true);
        });

        overlay.addEventListener('mouseleave', () => {
            this.handleOverlayHover(overlay, false);
        });
    }

    /**
     * Обработчик клика по overlay
     * @param {HTMLElement} overlay - Overlay элемент
     * @param {Object} eventData - Данные события
     */
    handleOverlayClick(overlay, eventData) {
        // Создаем событие для уведомления других компонентов
        const overlayClickEvent = new CustomEvent('overlayClick', {
            detail: {
                overlay: overlay,
                eventData: this.getEventDataFromOverlay(overlay),
                originalEventData: eventData
            },
            bubbles: true
        });

        overlay.dispatchEvent(overlayClickEvent);
    }

    /**
     * Обработчик наведения на overlay
     * @param {HTMLElement} overlay - Overlay элемент
     * @param {boolean} isHovering - Наведен ли курсор
     */
    handleOverlayHover(overlay, isHovering) {
        if (isHovering) {
            overlay.style.opacity = '0.9';
            overlay.style.zIndex = '10';
        } else {
            overlay.style.opacity = '1';
            overlay.style.zIndex = '';
        }
    }

    /**
     * Удалить overlay по ID события
     * @param {string} eventId - ID события
     * @returns {boolean} Успешно ли удалено
     */
    remove(eventId) {
        const overlay = this.overlays.get(eventId);

        if (overlay) {
            overlay.remove();
            this.overlays.delete(eventId);
            return true;
        }

        // Если не нашли в Map, ищем в DOM
        const domOverlay = document.querySelector(`.event-item[data-id="${eventId}"]`);
        if (domOverlay) {
            domOverlay.remove();
            return true;
        }

        console.warn(`Overlay с ID ${eventId} не найден`);
        return false;
    }

    /**
     * Удалить все overlay
     */
    clearAll() {
        this.overlays.forEach((overlay, eventId) => {
            overlay.remove();
        });
        this.overlays.clear();

        // Дополнительная очистка DOM на случай рассинхронизации
        if (this.overlaysContainer) {
            this.overlaysContainer.innerHTML = '';
        }
    }

    /**
     * Обновить позиции всех overlay
     * Используется при изменении размера окна или прокрутке
     */
    updatePositions() {
        this.overlays.forEach((overlay, eventId) => {
            this.updateOverlayPosition(overlay);
        });
    }



    /**
     * Обновить позицию конкретного overlay
     * @param {HTMLElement} overlay - Overlay элемент
     */
    updateOverlayPosition(overlay) {
        const time = overlay.getAttribute('data-time');
        const date = overlay.getAttribute('data-date');
        const duration = parseFloat(overlay.getAttribute('data-duration') || '1');

        // Ищем именно ЯЧЕЙКУ расписания по классу
        const cell = document.querySelector(
            `.schedule-cell[data-date="${date}"][data-time="${time.substring(0, 2)}:00"]`
        );

        if (cell) {
            const position = domUtils.calculateEventPosition(cell, duration, time);
            if (position) {
                Object.assign(overlay.style, {
                    top: `${position.top}px`,
                    left: `${position.left}px`,
                    width: `${position.width}px`,
                    height: `${position.height}px`
                });
            }
        }
    }

    /**
     * Найти overlay по ID
     * @param {string} eventId - ID события
     * @returns {HTMLElement|null} Overlay элемент или null
     */
    findById(eventId) {
        return this.overlays.get(eventId) ||
               document.querySelector(`.event-item[data-id="${eventId}"]`);
    }

    /**
     * Найти все overlay для определенной даты и времени
     * @param {string} date - Дата (YYYY-MM-DD)
     * @param {number} time - Время в часах
     * @returns {Array<HTMLElement>} Массив overlay элементов
     */
    findByDateTime(date, time) {
        const overlays = Array.from(this.overlays.values()).filter(overlay => {
            return overlay.getAttribute('data-date') === date &&
                   parseInt(overlay.getAttribute('data-time')) === time;
        });

        return overlays.length > 0 ? overlays :
            Array.from(document.querySelectorAll(
                `.event-item[data-date="${date}"][data-time="${time}"]`
            ));
    }

    /**
     * Получить данные события из overlay
     * @param {HTMLElement} overlay - Overlay элемент
     * @returns {Object} Данные события
     */
    getEventDataFromOverlay(overlay) {
        const rawData = {
            [EVENT_FIELDS.ID]: overlay.getAttribute(DATA_ATTRIBUTES.ID),
            [EVENT_FIELDS.DATE]: overlay.getAttribute(DATA_ATTRIBUTES.DATE),
            [EVENT_FIELDS.TIME]: overlay.getAttribute(DATA_ATTRIBUTES.TIME),
            [EVENT_FIELDS.TEXT]: overlay.textContent,
            [EVENT_FIELDS.COLOR]: overlay.getAttribute(DATA_ATTRIBUTES.COLOR),
            [EVENT_FIELDS.DURATION]: parseFloat(overlay.getAttribute(DATA_ATTRIBUTES.DURATION) || EVENT_DEFAULTS.DURATION),
            [EVENT_FIELDS.START_MINUTES]: parseInt(overlay.getAttribute(DATA_ATTRIBUTES.START_MINUTES) || EVENT_DEFAULTS.START_MINUTES),
            [EVENT_FIELDS.IS_RECURRING]: overlay.getAttribute(DATA_ATTRIBUTES.RECURRING) === 'true',
            [EVENT_FIELDS.OVERLAY]: overlay
        };
        return new EventDTO(rawData);
    }

    /**
     * Получить количество overlay
     * @returns {number} Количество overlay
     */
    getCount() {
        return this.overlays.size;
    }

    /**
     * Проверить, существует ли overlay для события
     * @param {string} eventId - ID события
     * @returns {boolean} Существует ли overlay
     */
    exists(eventId) {
        return this.overlays.has(eventId) ||
               !!document.querySelector(`.event-item[data-id="${eventId}"]`);
    }
}