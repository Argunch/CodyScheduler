import { domUtils, eventUtils } from '../utils/utils.js';
import { EventDTO } from '../models/event-dto.js';
import { EVENT_FIELDS, DATA_ATTRIBUTES, EVENT_STRUCTURE, DATA_ATTRIBUTE_MAPPING } from '../constants/event-fields.js';


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
        const dto = new EventDTO(eventData);

        // Автоматически устанавливаем все атрибуты из маппинга
        Object.entries(DATA_ATTRIBUTE_MAPPING).forEach(([attr, field]) => {
            const value = dto[field];
            if (value !== null && value !== undefined) {
                overlay.setAttribute(attr, value.toString());
            }
        });

        // Добавляем класс для нередактируемых событий
        if (!dto.canEdit) {
            overlay.classList.add('non-editable');
        }
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
            this.emitOverlayClick(overlay, eventData);
        });

        // Дополнительные события можно добавить здесь
        overlay.addEventListener('mouseenter', () => {
            this.handleOverlayHover(overlay, true);
        });

        overlay.addEventListener('mouseleave', () => {
            this.handleOverlayHover(overlay, false);
        });
    }

    emitOverlayClick(overlay, eventData) {
        const eventDataFromOverlay = eventUtils.extractEventFromOverlay(overlay);
        
        const overlayClickEvent = new CustomEvent('overlayClicked', { // переименовали событие
            detail: {
                overlay: overlay,
                eventData: eventDataFromOverlay,
                originalEventData: eventData
            },
            bubbles: true
        });
        overlay.dispatchEvent(overlayClickEvent);
    }

        /**
     * Получить ID текущего пользователя
     */
    getCurrentUserId() {
        const userElement = document.querySelector('[data-user-id]');
        return userElement ? userElement.dataset.userId : '';
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


    /**
     * Получить данные текущей видимой недели из DOM
     */
    getCurrentWeekData() {
        const dateCells = document.querySelectorAll('.schedule-cell[data-date]');
        if (dateCells.length === 0) {
            console.warn('Ячейки расписания не найдены');
            return null;
        }
        
        const dates = Array.from(dateCells).map(cell => 
            cell.getAttribute('data-date')
        ).filter((date, index, self) => 
            date && self.indexOf(date) === index
        ).sort();
        
        return {
            dateFrom: dates[0],
            dateTo: dates[dates.length - 1],
            dates: dates,
            daysCount: dates.length
        };
    }

    /**
     * Обновить overlays для текущей недели (легкая версия)
     */
    refreshCurrentWeek() {
        console.log('🔄 Обновление overlays текущей недели...');
        
        const weekData = this.getCurrentWeekData();
        if (!weekData) {
            console.warn('Не удалось получить данные недели для обновления');
            return;
        }
        
        // Удаляем только overlays текущей недели
        this.removeOverlaysForDates(weekData.dates);
        
        console.log(`✅ Удалены overlays для ${weekData.daysCount} дней`);
        // Новые overlays создадутся при следующем клике или через API
    }

    /**
     * Удалить overlays для определенных дат
     */
    removeOverlaysForDates(dates) {
        let removedCount = 0;
        
        dates.forEach(date => {
            const overlaysForDate = document.querySelectorAll(
                `.event-item[data-date="${date}"]`
            );
            
            overlaysForDate.forEach(overlay => {
                const eventId = overlay.getAttribute('data-id');
                if (eventId) {
                    this.overlays.delete(eventId);
                }
                overlay.remove();
                removedCount++;
            });
        });
        
        console.log(`🗑️ Удалено ${removedCount} overlays для ${dates.length} дат`);
    }
}