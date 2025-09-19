import { currentWeek } from './schedule_controller.js';

const API_BASE_URL='/api';

let currentCell=null;
let selectedColor = null;


function showEventModal(cell, eventData=null)
{
    currentCell=cell;
    selectedColor = null;

    const day=cell.getAttribute('data-day');
    const time=cell.getAttribute('data-time');
    const date=cell.getAttribute('data-date');

    const dayNames = {
        'mon': 'Понедельник',
        'tue': 'Вторник',
        'wed': 'Среда',
        'thu': 'Четверг',
        'fri': 'Пятница',
        'sat': 'Суббота',
        'sun': 'Воскресенье'
    };

    // СБРОС ВСЕХ ЦВЕТОВЫХ ОПЦИЙ ПЕРЕД ОТКРЫТИЕМ МОДАЛЬНОГО ОКНА
    document.querySelectorAll('.color-option').forEach(opt => {
        opt.classList.remove('selected');
    });

    // Показываем информацию о времени
    document.getElementById('modal-time-info').textContent =
        `${dayNames[day]}, ${date} ${time}:00`;

    // === РАЗДЕЛЕНИЕ ЛОГИКИ ===
    if (eventData) {
        // Редактирование существующего события
        // Заполняем текстовое поле текущим текстом ячейки
        document.getElementById('event-text').value = eventData.text || '';

        // Восстановление цвета
        if (eventData.color) {
            // Ищем ТОЛЬКО внутри модального окна
            const modal = document.getElementById('event-modal');
            const colorElement = modal.querySelector(`[data-color="${eventData.color}"]`);
            if (colorElement) {
                colorElement.classList.add('selected');
            }
        }

        // Восстановление продолжительности
        document.getElementById('event-duration').value = eventData.duration || '1';

        // Восстановление регулярности
        const isRecurring = eventData.isRecurring || false;
        document.getElementById('is-recurring').checked = isRecurring;

    }
    else
    {
        // Создание нового события
        document.getElementById('event-text').value = '';

        // Сброс цвета
        document.querySelectorAll('.color-option').forEach(opt => {
            opt.classList.remove('selected');
        });

        // Устанавливаем синий цвет по умолчанию
        selectedColor = 'blue';
        // Ищем ТОЛЬКО внутри модального окна
        const modal = document.getElementById('event-modal');
        const blueElement = modal.querySelector('[data-color="blue"]');
        if (blueElement) {
            blueElement.classList.add('selected');
        }

         // Продолжительность по умолчанию
        document.getElementById('event-duration').value = '1';

        // Сброс регулярности
        document.getElementById('is-recurring').checked = false;
    }
    // Показываем модальное окно и затемнение
    document.getElementById('event-modal').style.display = 'block';
    document.getElementById('modal-overlay').style.display = 'block';

    // Показываем / скрываем кнопку удаления
    toggleDeleteButton();

    // Фокусируемся на текстовом поле
    document.getElementById('event-text').focus();
}

// Функция для расчета позиции overlay
function calculateEventPosition(cell, durationHours = 1) {
    const scheduleContainer = document.querySelector('.schedule-container');
    const timeColumn = document.querySelector('.time-column');
    const daysContainer = document.querySelector('.days-container');

    // Получаем позицию ячейки относительно расписания
    const cellRect = cell.getBoundingClientRect();
    const scheduleRect = scheduleContainer.getBoundingClientRect();
    const timeColumnWidth = timeColumn.offsetWidth;

    // Вычисляем позицию
    const top = cellRect.top - scheduleRect.top + scheduleContainer.scrollTop;
    const left = cellRect.left - scheduleRect.left;
    const width = cell.offsetWidth;
    const height = cell.offsetHeight * durationHours;

    return {
        top: top,
        left: left,
        width: width*0.9,
        height: height,
        time: parseInt(cell.getAttribute('data-time')),
        date: cell.getAttribute('data-date')
    };
}

// Создание overlay события
function createEventOverlay(cell, text, color, durationHours, isRecurring = false) {
    const position = calculateEventPosition(cell, durationHours);

    const overlay = document.createElement('div');
    overlay.className = `event-item ${color || ''}`;
    overlay.style.top = `${position.top}px`;
    overlay.style.left = `${position.left}px`;
    overlay.style.width = `${position.width}px`;
    overlay.style.height = `${position.height}px`;
    overlay.textContent = text;
    overlay.setAttribute('data-time', position.time);
    overlay.setAttribute('data-date', position.date);
    overlay.setAttribute('data-duration', durationHours);
    overlay.setAttribute('data-color', color);
    overlay.setAttribute('data-recurring', isRecurring); // Добавьте это

    // Для коротких событий уменьшаем шрифт
    if (durationHours < 1.5) {
        overlay.classList.add('short');
    }

    overlay.addEventListener('click', function(e) {
        e.stopPropagation();

        // Создаем объект с данными события
        const eventData = {
            date: this.getAttribute('data-date'),
            time: this.getAttribute('data-time'),
            text: this.textContent,
            color: this.getAttribute('data-color'),
            duration: this.getAttribute('data-duration'),
            isRecurring: this.getAttribute('data-recurring') === 'true'
        };
        // Находим соответствующую ячейку
        const correspondingCell = document.querySelector(
            `[data-date="${eventData.date}"][data-time="${eventData.time}"]`
        );
        if (cell) {
            showEventModal(correspondingCell, eventData); // С eventData - редактирование
        }
    });

    // ВАЖНО: Добавляем в отдельный контейнер, а не в ячейку!
    document.getElementById('events-overlay').appendChild(overlay);
    return overlay;
}

function updateOverlayPositions() {
    const events = document.querySelectorAll('.event-item');
    events.forEach(event => {
        const time = event.getAttribute('data-time');
        const date = event.getAttribute('data-date');
        const duration = parseFloat(event.getAttribute('data-duration') || '1');

        const cell = document.querySelector(
            `[data-date="${date}"][data-time="${time}"]`
        );

        if (cell) {
            const position = calculateEventPosition(cell, duration);
            if (position) {
                event.style.top = `${position.top}px`;
                event.style.left = `${position.left}px`;
                event.style.width = `${position.width}px`;
                event.style.height = `${position.height}px`;
            }
        }
    });
}

// Удаление overlay
function removeEventOverlay(cell) {
    const time = cell.getAttribute('data-time');
    const date = cell.getAttribute('data-date');

    // Нормализуем формат времени для поиска
    const normalizedTime = time.padStart(2, '0') + ':00:00';

    const overlay = document.querySelector(
        `.event-item[data-date="${date}"][data-time="${time}"],
         .event-item[data-date="${date}"][data-time="${normalizedTime}"]`
    );

    if (overlay) {
        overlay.remove();
    }
}


// Функция скрытия модального окна
function hideEventModal() {
    document.getElementById('event-modal').style.display = 'none';
    document.getElementById('modal-overlay').style.display = 'none';
    currentCell = null;
}

async function deleteEvent()
{
    if (currentCell)
    {
        // Очищаем ячейку
        currentCell.textContent = '';
        currentCell.classList.remove('blue', 'yellow', 'green');
        currentCell.removeAttribute('data-color');

        // Удаляем на сервере
        await deleteEventFromServer(currentCell);
    }
    hideEventModal();
}

// Функция отправки запроса на удаление на сервер
async function deleteEventFromServer(cell) {
    const date = cell.getAttribute('data-date');
    let time = cell.getAttribute('data-time');
    const isRecurring = document.getElementById('is-recurring')?.checked;

    // Нормализуем время для корректного сравнения
    // Преобразуем время в правильный формат HH:MM:SS
    let normalizedTime = time;
    if (time && !time.includes(':')) {
        normalizedTime = time.padStart(2, '0') + ':00:00';
    }

    try {
        const response = await fetch(`${API_BASE_URL}/delete-event/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken(),
            },
            body: JSON.stringify({
                date: date,
                time: normalizedTime,
                delete_recurring: isRecurring
            })
        });

        const data = await response.json();
        if (data.status !== 'success') {
            console.error('Ошибка удаления:', data.message);
        } else {
            await loadEventsForWeek();
        }
    } catch (error) {
        console.error('Ошибка сети:', error);
    }
}

// Функция проверки, есть ли существующая запись в ячейке
function hasExistingEvent(cell) {
    return cell.textContent.trim() !== '' || cell.getAttribute('data-color');
}



// Функция показа/скрытия кнопки удаления
function toggleDeleteButton() {
    const deleteBtn = document.getElementById('delete-note');
    if (currentCell && hasExistingEvent(currentCell)) {
        deleteBtn.style.display = 'inline-block'; // Показываем кнопку
    } else {
        deleteBtn.style.display = 'none'; // Скрываем кнопку
    }
}

// Функция показа/скрытия кнопки удаления регулярных занятий
function toggleRecurringDeleteOption() {
    const option = document.getElementById('recurring-delete-option');
    const isRecurring = currentCell.getAttribute('data-recurring') === 'true';
    option.style.display = isRecurring ? 'block' : 'none';
}


async function saveEventToServer(cell,text,color,isRecurring=false, duration = 1.0)
{
    const date=cell.getAttribute('data-date');
    const time=cell.getAttribute('data-time');

    try
    {
        const response=await fetch(`${API_BASE_URL}/save-event/`, {
            method:'POST',
            headers:{
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken(),
            },
            body: JSON.stringify({
                date: date,
                time: time,
                text: text,
                color: color || 'blue',
                is_recurring: isRecurring,  // Добавляем флаг регулярности
                duration: duration
            })
        });

        const data = await response.json();
        if (data.status !== 'success') {
            console.error('Ошибка сохранения:', data.message);
        }
    }
    catch(error)
    {
        console.error('Ошибка сети:',error);
    }
}

async function loadEventsFromServer(dateFrom,dateTo)
{
    try{
        const response = await fetch(
            `${API_BASE_URL}/load-events/?date_from=${dateFrom}&date_to=${dateTo}`,
            {
                headers: {
                    'X-CSRFToken': getCSRFToken(),
                }
            }
        );
        const data = await response.json();
        if (data.status === 'success') {
            return data.events;
        } else {
            console.error('Ошибка загрузки:', data.message);
            return [];
        }
    }
    catch(error)
    {
        console.error('Ошибка сети:',error);
        return [];
    }
}

// Получение CSRF токена (Django требует это для POST запросов)
function getCSRFToken() {
    const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken='))
        ?.split('=')[1];

    return cookieValue || '';
}

// Функция сохранения события
function saveEvent() {
    if (currentCell) {
        const eventText = document.getElementById('event-text').value;
        const isRecurring = document.getElementById('is-recurring').checked;
        const duration = parseFloat(document.getElementById('event-duration').value) || 1;

        // Сохраняем данные в ячейку (для хранения)
        currentCell.setAttribute('data-duration', duration);
        currentCell.setAttribute('data-text', eventText);
        currentCell.setAttribute('data-color', selectedColor || 'blue');

        // Удаляем старый overlay если есть
        removeEventOverlay(currentCell);

        // Создаем новый overlay
        createEventOverlay(currentCell, eventText, selectedColor, duration, isRecurring);
        saveEventToServer(currentCell, eventText, selectedColor, isRecurring, duration);
    }


    hideEventModal();
}

function clearAllCells() {
    document.querySelectorAll('.schedule-cell').forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('blue', 'yellow', 'green');
        cell.removeAttribute('data-color');
    });
}

async function loadEventsForWeek()
{
    if (!currentWeek.days.length)
    {
        console.log('currentWeek.days пустой');
        return;
    }
    const dateFrom = currentWeek.days[0].date;
    const dateTo = currentWeek.days[6].date;

//    clearAllCells();

    // Очищаем overlay
    document.getElementById('events-overlay').innerHTML = '';

    // Загружаем с сервера
    const serverEvents = await loadEventsFromServer(dateFrom, dateTo);
    // Применяем события к ячейкам
    serverEvents.forEach(event => {
        const cell = document.querySelector(
            `[data-date="${event.date}"][data-time="${event.time}"]`
        );

        if (cell) {
             // Сохраняем данные в ячейке
            cell.setAttribute('data-text', event.text);
            cell.setAttribute('data-color', event.color || '');
            cell.setAttribute('data-duration', event.duration || '1');

            // Создаем overlay
            createEventOverlay(
                cell,
                event.text,
                event.color,
                parseFloat(event.duration || 1),
                event.is_recurring || false
            );
        }
    });
}

// Обработчик выбора цвета
document.querySelectorAll('.color-option').forEach(option => {
    option.addEventListener('click', function() {
        // Убираем выделение у всех
        document.querySelectorAll('.color-option').forEach(opt => {
            opt.classList.remove('selected');
        });

        // Выделяем выбранный
        this.classList.add('selected');
        selectedColor = this.getAttribute('data-color');
    });
});

export {saveEvent,deleteEvent,hideEventModal,showEventModal,loadEventsForWeek,updateOverlayPositions};