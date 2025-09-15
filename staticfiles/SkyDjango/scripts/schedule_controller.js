import { loadEventsForWeek, showEventModal } from './add_note.js';

const DAY_NAMES = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const DAY_SHORT_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const DAY_IDS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

let currentWeek = {
  startDate: getMonday(new Date()),
  days: []
};

let showAllHours = false; // Флаг для отображения всех часов

// Основная функция инициализации
function initCurrentWeek() {
    updateWeekData();
    generateSchedule();
    updateWeekDisplay();
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
function generateSchedule() {
    const container = document.getElementById('schedule-container');
    container.innerHTML = '';

    const daysContainer = document.createElement('div');
    daysContainer.className = 'days-container';

    // Колонка времени
    daysContainer.appendChild(createTimeColumn());

    // Колонки дней
    currentWeek.days.forEach(day => {
        daysContainer.appendChild(createDayColumn(day));
    });

    container.appendChild(daysContainer);

    loadEventsForWeek();
}

// Создание колонки времени
function createTimeColumn() {
    const timeColumn = document.createElement('div');
    timeColumn.className = 'time-column';

    timeColumn.appendChild(createElement('div', 'day-header', ''));

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
    dayColumn.appendChild(header);

    // Ячейки времени
    for (let hour = 0; hour < 24; hour++) {
        const cell = createElement('div', 'schedule-cell', '');
        cell.setAttribute('data-day', day.day);
        cell.setAttribute('data-time', hour);
        cell.setAttribute('data-date', day.date);
        cell.title = `${formatDate(day.date)}\n${hour}:00`;
        cell.addEventListener('click', function() {showEventModal(this);});
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
function changeWeek(daysOffset) {
    currentWeek.startDate.setDate(currentWeek.startDate.getDate() + daysOffset);
    updateWeekData();
    generateSchedule();
    updateWeekDisplay();
    loadEventsForWeek();
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

export {
    initCurrentWeek,
    goToPrevWeek,
    goToNextWeek,
    currentWeek,
    toggleHoursVisibility,
};



