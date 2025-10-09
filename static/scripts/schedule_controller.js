import { TimelineManager } from './services/timeline-manager.js';

const DAY_NAMES = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const DAY_SHORT_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const DAY_IDS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

let currentWeek = {
  startDate: getMonday(new Date()),
  days: []
};

// Создаем экземпляр TimelineManager
const timelineManager = new TimelineManager();

let showAllHours = false; // Флаг для отображения всех часов

// Основная функция инициализации
async function initCurrentWeek() {
    updateWeekData();
    await generateSchedule();
    updateWeekDisplay();
    timelineManager.init(currentWeek);

    // 🔥 ДОБАВЛЯЕМ ПОДСВЕТКУ ТЕКУЩЕГО ДНЯ
    highlightCurrentDay();

    return currentWeek;
}

// Обновляем данные недели
function updateWeekData() {
    currentWeek.days = [];

    for (let i = 0; i < 7; i++) {
        const date = new Date(currentWeek.startDate);
        date.setDate(currentWeek.startDate.getDate() + i);

        const dateStr = date.toISOString().split('T')[0];

        currentWeek.days.push({
            date: dateStr,
            day: DAY_IDS[i],
            dayName: DAY_NAMES[i],
            shortName: DAY_SHORT_NAMES[i],
            dayOfMonth: date.getDate()
        });
    }
}

// Генерация расписания
async function generateSchedule() {
    const container = document.getElementById('schedule-container');
    // Сохраняем overlay перед очисткой
    const overlay = document.getElementById('events-overlay');

    // Очищаем только содержимое расписания, но не overlay
    const daysContainer = container.querySelector('.days-container');
    if (daysContainer) {
        daysContainer.remove();
    }

    // Создаем новый days-container
    const newDaysContainer = document.createElement('div');
    newDaysContainer.className = 'days-container';

    // Колонка времени
    newDaysContainer.appendChild(createTimeColumn());

    // Колонки дней
    currentWeek.days.forEach(day => {
        newDaysContainer.appendChild(createDayColumn(day));
    });

    container.appendChild(newDaysContainer);

    return Promise.resolve();
}

// Создание колонки времени
function createTimeColumn() {
    const timeColumn = document.createElement('div');
    timeColumn.className = 'time-column';

    timeColumn.appendChild(createElement('div', 'time-header', ''));

    for (let hour = 0; hour < 24; hour++) {
    // Скрываем ночные часы по умолчанию
        const timeCell = createElement('div', 'time-cell', `${hour}:00`);

        if (!shouldShowHour(hour)) {
            timeCell.style.display = 'none';
        }
        timeColumn.appendChild(timeCell);
    }

    return timeColumn;
}

// Создание колонки дня
function createDayColumn(day) {
    const dayColumn = document.createElement('div');
    dayColumn.className = 'day-column';

    // Заголовок дня
    const header = createElement('div', 'day-header', `${day.dayOfMonth}, ${day.shortName}`);
    header.title = `${day.dayName} ${day.date}`;

    // 🔥 ДОБАВЛЯЕМ ПРОВЕРКУ НА ТЕКУЩИЙ ДЕНЬ
    if (day.date === getCurrentDateString()) {
        header.classList.add('current-day');
    }

    dayColumn.appendChild(header);

    // Ячейки времени
    for (let hour = 0; hour < 24; hour++) {
        const cell = createElement('div', 'schedule-cell', '');
        cell.setAttribute('data-day', day.day);
        cell.setAttribute('data-time', `${hour.toString().padStart(2, '0')}:00`);
        cell.setAttribute('data-date', day.date);
        cell.title = `${formatDate(day.date)}\n${hour}:00`;
        // Скрываем ночные часы по умолчанию
        if (!shouldShowHour(hour)) {
            cell.style.display = 'none';
        }

        dayColumn.appendChild(cell);
    }

    return dayColumn;
}

// Вспомогательная функция создания элемента
function createElement(tag, className, textContent) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = textContent;
    return element;
}

// Форматирование даты
function formatDate(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${day}.${month}.${year}`;
}

// Переключение отображения всех часов
function toggleHoursVisibility() {
    showAllHours = !showAllHours;

    // Обновляем видимость ячеек времени
    document.querySelectorAll('.time-cell').forEach(cell => {
        const hour = parseInt(cell.textContent.split(':')[0]);
        cell.style.display = shouldShowHour(hour) ? 'block' : 'none';
    });

    // Обновляем видимость ячеек расписания
    document.querySelectorAll('.schedule-cell').forEach(cell => {
        const hour = parseInt(cell.getAttribute('data-time'));
        cell.style.display = shouldShowHour(hour) ? 'block' : 'none';
    });

    // Обновляем линии времени
    timelineManager.update();

    // Обновляем текст кнопки
    updateToggleButtonText();
}

// Проверка, нужно ли показывать час
function shouldShowHour(hour) {
    return showAllHours || (hour >= 7 && hour <= 20);
}

// Обновление текста кнопки
function updateToggleButtonText() {
    const button = document.getElementById('toggle-hours-btn');
    if (button) {
        button.textContent = showAllHours ? 'Скрыть ночные часы' : 'Показать все часы';
    }
}

// Обновление отображения диапазона недели
function updateWeekDisplay() {
    const start = currentWeek.days[0].date;
    const end = currentWeek.days[6].date;

    const weekRangeElement = document.getElementById('current-week-range');
    if (weekRangeElement) {
        weekRangeElement.textContent = `${formatDate(start)}-${formatDate(end)}`;
    }
}

// Навигация по неделям
async function changeWeek(daysOffset) {
    currentWeek.startDate.setDate(currentWeek.startDate.getDate() + daysOffset);
    updateWeekData();
    await generateSchedule();
    updateWeekDisplay();

    // Обновляем неделю в TimelineManager
    timelineManager.setCurrentWeek(currentWeek);

    // 🔥 ОБНОВЛЯЕМ ПОДСВЕТКУ ТЕКУЩЕГО ДНЯ
    highlightCurrentDay();

    // Возвращаем обновленную неделю для EventManager
    return currentWeek;
}

// 🔥 НОВАЯ ФУНКЦИЯ: Подсветка текущего дня
function highlightCurrentDay() {
    const currentDate = getCurrentDateString();

    // Убираем подсветку со всех заголовков
    document.querySelectorAll('.day-header').forEach(header => {
        header.classList.remove('current-day');
    });

    // Добавляем подсветку текущему дню
    const currentDayHeader = document.querySelector(`[data-date="${currentDate}"]`)?.closest('.day-column')?.querySelector('.day-header');
    if (currentDayHeader) {
        currentDayHeader.classList.add('current-day');
    }
}

// Получение понедельника для данной даты
function getMonday(date) {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
}

// Публичные методы
function goToNextWeek() {
    changeWeek(7);
}

function goToPrevWeek() {
    changeWeek(-7);
}



// Добавляем новую функцию
function getCurrentDateString() {
    return new Date().toISOString().split('T')[0];
}

export {
    initCurrentWeek,
    goToPrevWeek,
    goToNextWeek,
    currentWeek,
    toggleHoursVisibility,
    shouldShowHour,
    timelineManager
};



