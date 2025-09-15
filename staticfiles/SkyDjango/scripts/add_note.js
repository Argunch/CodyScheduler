import { currentWeek } from './schedule_controller.js';

const API_BASE_URL='/api';

let currentCell=null;
let selectedColor = null;

function showEventModal(cell)
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

    // Показываем информацию о времени
    document.getElementById('modal-time-info').textContent =
        `${dayNames[day]}, ${date} ${time}:00`;

    // Заполняем текстовое поле текущим текстом ячейки
    document.getElementById('event-text').value = cell.textContent;

    // Сброс выбора цвета
    document.querySelectorAll('.color-option').forEach(option => {
        option.classList.remove('selected');
    });

    // Восстановление ранее выбранного цвета
    const existingColor = cell.getAttribute('data-color');
    if (existingColor) {
        selectedColor = existingColor;
        document.querySelector(`[data-color="${existingColor}"]`).classList.add('selected');
    }

    // Показываем модальное окно и затемнение
    document.getElementById('event-modal').style.display = 'block';
    document.getElementById('modal-overlay').style.display = 'block';

    // Показываем / скрываем кнопку удаления
    toggleDeleteButton();

    // Фокусируемся на текстовом поле
    document.getElementById('event-text').focus();
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

    // Преобразуем время в правильный формат HH:MM:SS
    if (time && !time.includes(':')) {
        time = time.padStart(2, '0') + ':00:00'; // "7" → "07:00:00"
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
                time: time,
                delete_recurring: isRecurring
            })
        });

        const data = await response.json();
        if (data.status !== 'success') {
            console.error('Ошибка удаления:', data.message);
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


async function saveEventToServer(cell,text,color,isRecurring=false)
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
                color: color,
                is_recurring: isRecurring  // Добавляем флаг регулярности
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
        currentCell.textContent = eventText;

        // Устанавливаем цвет
        if (selectedColor) {
            // Убираем предыдущие классы цветов
            currentCell.classList.remove('blue', 'yellow', 'green');
            // Добавляем выбранный цвет
            currentCell.classList.add(selectedColor);
            currentCell.setAttribute('data-color', selectedColor);
        } else {
            // Если цвет не выбран, убираем цвет
            currentCell.classList.remove('blue', 'yellow', 'green');
            currentCell.removeAttribute('data-color');
        }
        // Сохраняем на сервер
        saveEventToServer(currentCell, eventText, selectedColor, isRecurring);
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

    clearAllCells();

    // Загружаем с сервера
    const serverEvents = await loadEventsFromServer(dateFrom, dateTo);
    // Применяем события к ячейкам
    serverEvents.forEach(event => {
        const cell = document.querySelector(
            `[data-date="${event.date}"][data-time="${event.time}"]`
        );

        if (cell) {
            cell.textContent = event.text;
            if (event.color) {
                cell.classList.remove('blue', 'yellow', 'green');
                cell.classList.add(event.color);
                cell.setAttribute('data-color', event.color);
            }
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

export {saveEvent,deleteEvent,hideEventModal,showEventModal,loadEventsForWeek};