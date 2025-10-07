import {shouldShowHour} from './schedule_controller.js';

function updateCurrentTimeLine(currentWeek, DAY_IDS) {
    const now = new Date();
    const currentDateStr = now.toISOString().split('T')[0];

    // Удаляем все существующие линии
    document.querySelectorAll('.current-time-line, .current-time-week-line').forEach(line => line.remove());

    // Проверяем, находится ли текущая дата в отображаемой неделе
    const isCurrentWeek = currentWeek.days.some(day => day.date === currentDateStr);
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
    const weekLine = document.createElement('div');
    weekLine.className = 'current-time-line current-time-week-line';
    weekLine.style.top = `${calculateLinePosition(currentHour, currentMinutes)}px`;
    // ИСПРАВЛЕНИЕ: Правильно вычисляем ширину для всей недели
    const totalWidth = calculateTotalWeekWidth();
    weekLine.style.width = `${totalWidth}px`; // Фиксированная ширина вместо 100%

    document.querySelector('.schedule-wrapper').appendChild(weekLine);

    // 2. СОЗДАЕМ ЛИНИЮ НА ТЕКУЩИЙ ДЕНЬ (толстая)
    const todayCells = document.querySelectorAll(`[data-day="${DAY_IDS[adjustedCurrentDay]}"]`);
    if (todayCells.length > 0) {
        const currentHourCell = Array.from(todayCells).find(cell => {
            const cellHour = parseInt(cell.getAttribute('data-time'));
            return cellHour === currentHour;
        });

        if (currentHourCell) {
            const dayLine = document.createElement('div');
            dayLine.className = 'current-time-line current-time-day-line';
            dayLine.style.top = `${calculateLinePosition(currentHour, currentMinutes)}px`;
            dayLine.style.left = `${timeColumnWidth + (adjustedCurrentDay * currentHourCell.offsetWidth)}px`;
            dayLine.style.width = `${currentHourCell.offsetWidth}px`;
            document.querySelector('.schedule-wrapper').appendChild(dayLine);
        }
    }

    // Показываем линии только если текущее время в пределах отображаемого диапазона
    const shouldShow = shouldShowHour(currentHour) ||
                      (currentHour === 20 && currentMinutes > 0) ||
                      (currentHour === 6 && currentMinutes < 59);

    document.querySelectorAll('.current-time-line').forEach(line => {
        line.style.display = shouldShow ? 'block' : 'none';
    });
}

// Новая функция для вычисления общей ширины недели
function calculateTotalWeekWidth() {
    const daysContainer = document.querySelector('.days-container');
    if (!daysContainer) return 0;

    // Ширина всех day-column минус time-column
    const timeColumn = document.querySelector('.time-column');
    const timeColumnWidth = timeColumn ? timeColumn.offsetWidth : 60;

    return daysContainer.offsetWidth - timeColumnWidth;
}


// Вспомогательная функция для вычисления позиции линии
function calculateLinePosition(hour, minutes) {
    const scheduleContainer = document.querySelector('.schedule-container');
    if (!scheduleContainer) return 0;

    // Находим любую ячейку для указанного часа
    const anyCell = document.querySelector(`[data-time="${hour}"]`);
    if (!anyCell) return 0;

    const cellRect = anyCell.getBoundingClientRect();
    const scheduleRect = scheduleContainer.getBoundingClientRect();

    return cellRect.top - scheduleRect.top + scheduleContainer.scrollTop +
           (minutes / 60) * anyCell.offsetHeight;
}

export {
    updateCurrentTimeLine
};