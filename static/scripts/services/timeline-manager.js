import { shouldShowHour } from '../constants/time-config.js';

export class TimelineManager {
    constructor() {
        this.currentWeek = null;
        this.DAY_IDS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
        this.updateInterval = null;
        this.isInitialized = false;

        // Привязка контекста
        this.update = this.update.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.handleScroll = this.handleScroll.bind(this);
    }

    /**
     * Инициализация менеджера временных линий
     */
    init(currentWeek) {
        if (this.isInitialized) return;

        this.currentWeek = currentWeek;
        this.setupEventListeners();
        this.startAutoUpdate();
        this.isInitialized = true;

        // Первоначальное обновление
        this.update();
    }

    /**
     * Обновить текущую неделю
     */
    setCurrentWeek(currentWeek) {
        this.currentWeek = currentWeek;
        this.update();
    }

    /**
     * Основной метод обновления линий
     */
    update() {
        if (!this.currentWeek) return;

        const now = new Date();
        const currentDateStr = now.toISOString().split('T')[0];

        // Удаляем все существующие линии
        this.removeAllLines();

        // Проверяем, находится ли текущая дата в отображаемой неделе
        const isCurrentWeek = this.currentWeek.days.some(day => day.date === currentDateStr);
        if (!isCurrentWeek) return;

        const currentDay = now.getDay();
        const currentHour = now.getHours();
        const currentMinutes = now.getMinutes();

        // Преобразуем воскресенье (0) в 6 для совместимости
        const adjustedCurrentDay = currentDay === 0 ? 6 : currentDay - 1;

        const scheduleContainer = document.querySelector('.schedule-container');
        if (!scheduleContainer) return;

        const timeColumn = document.querySelector('.time-column');
        const timeColumnWidth = timeColumn ? timeColumn.offsetWidth : 60;

        // 1. СОЗДАЕМ ЛИНИЮ НА ВСЮ НЕДЕЛЮ (тонкая)
        const weekLine = this.createWeekLine(currentHour, currentMinutes, timeColumnWidth);
        if (weekLine) {
            document.querySelector('.schedule-wrapper').appendChild(weekLine);
        }

        // 2. СОЗДАЕМ ЛИНИЮ НА ТЕКУЩИЙ ДЕНЬ (толстая)
        const dayLine = this.createDayLine(currentHour, currentMinutes, adjustedCurrentDay, timeColumnWidth);
        if (dayLine) {
            document.querySelector('.schedule-wrapper').appendChild(dayLine);
        }

        // Управляем видимостью линий
        this.updateLinesVisibility(currentHour, currentMinutes);
    }


     /**
     * Создать линию на всю неделю
     */
    createWeekLine(hour, minutes, timeColumnWidth) {
        // 1. СОЗДАЕМ ЛИНИЮ НА ВСЮ НЕДЕЛЮ (тонкая)
        const position = this.calculateLinePosition(hour, minutes);
        if (position === 0) return null;

        const weekLine = document.createElement('div');
        weekLine.className = 'current-time-line current-time-week-line';
        weekLine.style.top = `${position}px`;
        weekLine.style.left = `${Math.round(timeColumnWidth)}px`;

        // 🔥 ВЫРАВНИВАЕМ ШИРИНУ
        const totalWidth = Math.round(this.calculateTotalWeekWidth());
        weekLine.style.width = `${totalWidth}px`;

        return weekLine;
    }

        /**
     * Создать линию на текущий день
     */
    createDayLine(hour, minutes, adjustedCurrentDay, timeColumnWidth) {
        // 2. СОЗДАЕМ ЛИНИЮ НА ТЕКУЩИЙ ДЕНЬ (толстая)
        const todayCells = document.querySelectorAll(`[data-day="${this.DAY_IDS[adjustedCurrentDay]}"]`);
        if (todayCells.length === 0) return null;

        const currentHourCell = Array.from(todayCells).find(cell => {
            const cellHour = parseInt(cell.getAttribute('data-time'));
            return cellHour === hour;
        });

        if (!currentHourCell) return null;

        const position = this.calculateLinePosition(hour, minutes);
        if (position === 0) return null;

        const dayLine = document.createElement('div');
        dayLine.className = 'current-time-line current-time-day-line';

        // 🔥 ВЫРАВНИВАЕМ ВСЕ К ЦЕЛЫМ ПИКСЕЛЯМ
        const cellWidth = Math.round(currentHourCell.offsetWidth);
        const leftPosition = Math.round(timeColumnWidth + (adjustedCurrentDay * cellWidth));

        dayLine.style.top = `${position}px`;
        dayLine.style.left = `${leftPosition}px`;
        dayLine.style.width = `${cellWidth}px`;

        return dayLine;
    }


     /**
     * Обновить видимость линий
     */
    updateLinesVisibility(hour, minutes) {
        const shouldShow = shouldShowHour(hour) ||
                          (hour === 20 && minutes > 0) ||
                          (hour === 6 && minutes < 59);

        document.querySelectorAll('.current-time-line').forEach(line => {
            line.style.display = shouldShow ? 'block' : 'none';
        });
    }

     /**
     * Удалить все линии
     */
    removeAllLines() {
        document.querySelectorAll('.current-time-line, .current-time-week-line').forEach(line => line.remove());
    }

    // Новая функция для вычисления общей ширины недели
    calculateLinePosition(hour, minutes) {
        const scheduleContainer = document.querySelector('.schedule-container');
        if (!scheduleContainer) return 0;

        // Находим любую ячейку для указанного часа
        const anyCell = document.querySelector(`.schedule-cell[data-time="${hour.toString().padStart(2, '0')}:00"]`);
        if (!anyCell) return 0;

        const cellRect = anyCell.getBoundingClientRect();
        const scheduleRect = scheduleContainer.getBoundingClientRect();

        const rawPosition = cellRect.top - scheduleRect.top + scheduleContainer.scrollTop +
               (minutes / 60) * anyCell.offsetHeight;

        // 🔥 ВЫРАВНИВАЕМ К ЦЕЛЫМ ПИКСЕЛЯМ
        return Math.round(rawPosition);
    }


    // Вспомогательная функция для вычисления позиции линии
    calculateTotalWeekWidth() {
        const daysContainer = document.querySelector('.days-container');
        if (!daysContainer) return 0;

        return daysContainer.offsetWidth;
    }

    /**
     * Запуск автоматического обновления
     */
    startAutoUpdate() {
        // Обновляем каждую минуту
        this.updateInterval = setInterval(this.update, 60000);
    }

            /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        window.addEventListener('resize', this.handleResize);
        window.addEventListener('scroll', this.handleScroll);
    }

    /**
     * Обработчики событий с debounce
     */
    handleResize() {
        clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(() => this.update(), 150);
    }

    handleScroll() {
        clearTimeout(this.scrollTimer);
        this.scrollTimer = setTimeout(() => this.update(), 50);
    }

     /**
     * Остановка менеджера
     */
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('scroll', this.handleScroll);

        this.removeAllLines();
        this.isInitialized = false;
    }
}