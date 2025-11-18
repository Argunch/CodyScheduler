import { ApiService } from './api-service.js';
import { OverlayManager } from './overlay-manager.js';
import { eventStore } from './event-store.js';
import { eventUtils } from '../utils/utils.js';
import { EventDTO } from '../models/event-dto.js';

import { EventModal } from '../components/event-modal.js';
import { EventViewModal } from '../components/event-view-modal.js';

export class EventManager {
    constructor(options = {}) {
        // Инициализация сервисов
        this.apiService = options.apiService || new ApiService();
        this.overlayManager = options.overlayManager || new OverlayManager();
        this.eventModal = new EventModal(this.apiService, this.overlayManager, this);
        this.eventViewModal = new EventViewModal();

        // ДОБАВЛЯЕМ EventStore
        this.eventStore = eventStore;

        // Состояние приложения
        this.currentWeek = options.currentWeek || null;
        this.isInitialized = false;
        this.initPromise = null;

        // Таймеры
        this.resizeTimer = null;

        // Привязка контекста
        this.handleResize = this.handleResize.bind(this);
        this.handleKeydown = this.handleKeydown.bind(this);
        this.onOverlayClicked = this.onOverlayClicked.bind(this);

        this.initPromise = this.init();
    }

    /**
     * Инициализация менеджера событий
     */
    async init() {
        if (this.isInitialized) {
            return;
        }

        try {
            this.setupEventListeners();

            // Проверяем соединение с сервером
            const isConnected = await this.apiService.checkConnection();
            if (!isConnected) {
                console.warn('Сервер недоступен, работа в оффлайн режиме');
            }

            this.isInitialized = true;

        } catch (error) {
            console.error('Ошибка инициализации EventManager:', error);
            throw error;
        }
    }

     /**
     * Дождаться инициализации (публичный метод)
     */
    async waitForInit() {
        if (this.initPromise) {
            await this.initPromise;
        }
        return this;
    }

    /**
     * Настройка обработчиков событий DOM
     */
    setupEventListeners() {
        // Делегирование событий на ячейках расписания
        const scheduleContainer = document.querySelector('.schedule-container');
        if (scheduleContainer) {
            scheduleContainer.addEventListener('click', (e) => {
                const cell = e.target.closest('.schedule-cell');
                if (cell) {
                    this.handleCellClick(cell);
                }
            });
        }

        // Обработчик изменения размера окна
        window.addEventListener('resize', this.handleResize);

        // Обработчик прокрутки
        window.addEventListener('scroll', this.handleResize);

        // Скролл расписания
        const scheduleWrapper = document.querySelector('.schedule-wrapper');
        if (scheduleWrapper) {
            scheduleWrapper.addEventListener('scroll', this.handleResize);
        }

        // Глобальные обработчики клавиш
        document.addEventListener('keydown', this.handleKeydown);

        // ← ДОБАВЛЕНО: Обработчик кликов по overlay
        document.addEventListener('overlayClicked', this.onOverlayClicked);

        // Обработчики для модального окна
        this.setupModalHandlers();
    }

    /**
     * Обработчик клика по overlay
     */
    // handleOverlayClick(event) {
    //     const { overlay } = event.detail;
    //     try {
    //         // ✅ Используем утилиту для извлечения данных
    //         const extractedEvent = EventUtils.extractEventFromOverlay(overlay);
            
    //         if (!extractedEvent.canEdit) {
    //             console.log('Редактирование запрещено');
    //             this.eventViewModal.show(extractedEvent);
    //         } else {
    //             this.eventModal.show(extractedEvent);
    //         }
    //     } catch (error) {
    //         console.error('Ошибка при обработке клика по overlay:', error);
    //     }
    // }

    onOverlayClicked(event) {
        const { eventData } = event.detail;
        
        // Вся бизнес-логика здесь
        if (!eventData.canEdit) {
            this.eventViewModal.show(eventData);
        } else {
            this.eventModal.show(eventData);
        }
    }


    /**
     * Проверить, можно ли редактировать событие
     */
    canEditEvent(overlay, eventData) {
        // Получаем флаг canEdit из data-атрибута или из eventData
        const canEdit = overlay.getAttribute('data-can-edit') === 'true' ||
                       eventData.canEdit === true;

        if (!canEdit) {
            return false;
        }

        return true;
    }

    /**
     * Настройка обработчиков модального окна
     */
    setupModalHandlers() {
        // Кнопка сохранения
        const saveBtn = document.getElementById('modal-ok');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.eventModal.save());
        }

        // Кнопка отмены
        const cancelBtn = document.getElementById('modal-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.eventModal.hide());
        }

        // Кнопка удаления
        const deleteBtn = document.getElementById('delete-note');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => this.eventModal.delete());
        }

        // Закрытие по клику на затемнение
        const modalOverlay = document.getElementById('modal-overlay');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', (event) => {
                if (event.target === event.currentTarget) {
                    this.eventModal.hide();
                }
            });
        }

        // Валидация поля продолжительности
        const durationInput = document.getElementById('event-duration');
        if (durationInput) {
            durationInput.addEventListener('input', (e) => {
                this.eventModal.validateTimeInput(e.target);
            });
        }
    }

    /**
     * Обработчик ресайза, скролла с debounce
     */
    handleResize() {
        clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(() => {
            this.overlayManager.updatePositions();
        }, 150); // Оптимальный тайминг
    }

    /**
     * Обработчик нажатия клавиш
     * @param {KeyboardEvent} event - Событие клавиатуры
     */
    handleKeydown(event) {
        // ESC - закрыть модальное окно
        if (event.key === 'Escape') {
            this.eventModal.hide();
        }

        // Ctrl+S - сохранить (только когда модальное окно открыто)
        if (event.ctrlKey && event.key === 's') {
            event.preventDefault();
            if (this.eventModal.isVisible()) {
                this.eventModal.save();
            }
        }
    }

    /**
     * Обработчик клика по ячейке расписания
     * @param {HTMLElement} cell - Ячейка расписания
     */
    handleCellClick(cell) {
        if (!this.isInitialized) {
            console.warn('EventManager не инициализирован');
            return;
        }

        // ОПРЕДЕЛЯЕМ, В ЧЬЁ РАСПИСАНИЕ ДОБАВЛЯЕМ ЗАМЕТКУ
        const userSelect = document.getElementById('user-select');
        const targetUserId = userSelect && userSelect.value !== 'self' ? userSelect.value : null;

        // Создание нового события
        this.eventModal.show(null, cell, targetUserId);
    }



    /**
     * Загрузить события для текущей недели
     * @param {Array} weekDays - Дни недели
     */
    async loadEventsForWeek(weekDays = null) {
        if (!this.isInitialized) {
            console.warn('EventManager не инициализирован');
            await this.waitForInit();
        }

        try {
            const targetWeekDays = weekDays || this.currentWeek?.days;

            if (!targetWeekDays || targetWeekDays.length === 0) {
                console.warn('Не указаны дни недели для загрузки');
                return;
            }

            // Очищаем существующие overlay
            this.overlayManager.clearAll();

            // Загружаем события с сервера
            const events = await this.apiService.loadEventsForWeek(targetWeekDays);

            // ✅ СОХРАНЯЕМ В EventStore
            const normalizedEvents = events.map(event => eventUtils.normalizeEvent(event));
            this.eventStore.setEvents(normalizedEvents);

            // Создаем overlay для каждого события
            events.forEach(event => {
                this.createEventOverlay(event);
            });
        } catch (error) {
            console.error('Ошибка при загрузке событий:', error);
        }
    }

    /**
     * СОЗДАТЬ событие (новая версия с EventStore)
     * @param {Object} eventData - Данные события
     */
    async createEvent(eventData) {
        try {
            // ✅ ПРЕДОБРАБОТКА ДАННЫХ ПЕРЕД ОТПРАВКОЙ
            const processedData = EventDTO.prepareForApi(eventData);

            const response = await this.apiService.saveEvent(processedData);
            
            if (response.status === 'success') {
                // ✅ Используем DTO для объединения данных
                const eventDTO = EventDTO.mergeWithResponse(processedData, response);
                
                // Сохраняем в хранилище
                const storedEvent = this.eventStore.setEvent(eventDTO);
                
                // Создаем overlay
                this.createEventOverlay(storedEvent);
                
                // console.log('✅ Событие создано и сохранено в EventStore:', storedEvent);
                return storedEvent;
            }
            throw new Error(response.message);
        } catch (error) {
            console.error('❌ Ошибка создания события:', error);
            throw error;
        }
    }

    /**
     * Подготовить данные события перед отправкой
     */
    prepareEventData(eventData) {
        const processedData = { ...eventData };
        
        // ✅ ГЕНЕРИРУЕМ series_id ДЛЯ РЕГУЛЯРНЫХ СОБЫТИЙ
        if (processedData.is_recurring && !processedData.series_id) {
            processedData.series_id = EventDTO.generateSeriesId();
        }
        
        // ✅ УБИРАЕМ series_id ДЛЯ НЕРЕГУЛЯРНЫХ СОБЫТИЙ
        if (!processedData.is_recurring) {
            delete processedData.series_id;
        }
        
        // ✅ ОБРАБОТКА NULL ЗНАЧЕНИЙ
        Object.keys(processedData).forEach(key => {
            if (processedData[key] === null) {
                delete processedData[key];
            }
        });
        
        console.log('📦 Подготовленные данные для отправки:', processedData);
        return processedData;
    }

    /**
     * Генерирует UUID для серии событий
     */
    generateSeriesId() {
        return 'series_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Создать overlay для события
     * @param {Object} eventData - Данные события
     */
    createEventOverlay(eventData) {
        try {
            const cell=this.overlayManager.findCellForEvent(eventData)
            if (cell) {
                const startMinutes = eventData.startMinutes !== undefined
                ? eventData.startMinutes
                : parseInt(eventData.time.split(':')[1] || '0');
                this.overlayManager.create(cell, {
                    ...eventData,
                    startMinutes: startMinutes
                });
            } else {
                console.warn('Ячейка не найдена для события:', eventData);
            }
        } catch (error) {
            console.error('Ошибка при создании overlay:', error);
        }
    }

    /**
     * Установить текущую неделю
     * @param {Object} week - Данные недели
     */
    setCurrentWeek(week) {
        this.currentWeek = week;

        // Автоматически загружаем события для новой недели
        if (week && week.days) {
            this.loadEventsForWeek(week.days);
        }
    }

    /**
     * Обновить позиции overlay (публичный метод для внешнего вызова)
     */
    updateOverlayPositions() {
        this.overlayManager.updatePositions();
    }

    /**
     * Проверить, видимо ли модальное окно
     */
    isModalVisible() {
        return this.eventModal.isVisible();
    }

    /**
     * Получить текущее состояние менеджера
     * @returns {Object} Состояние менеджера
     */
    getState() {
        return {
            isInitialized: this.isInitialized,
            eventCount: this.overlayManager.getCount(),
            currentWeek: this.currentWeek,
            serverAvailable: this.apiService.checkConnection()
        };
    }

    /**
     * Очистка ресурсов (для разрушения)
     */
    destroy() {
        // Убираем обработчики событий
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('scroll', this.handleResize);
        document.removeEventListener('keydown', this.handleKeydown);
        document.removeEventListener('overlayClicked', this.onOverlayClicked);

        const scheduleWrapper = document.querySelector('.schedule-wrapper');
        if (scheduleWrapper) {
            scheduleWrapper.removeEventListener('scroll', this.handleResize);
        }

        // Очищаем overlay
        this.overlayManager.clearAll();

        // Закрываем модальное окно
        this.eventModal.hide();

        this.isInitialized = false;
        console.log('EventManager уничтожен');
    }

}