import { loadEventsForWeek } from './add_note.js';

let currentWeek = {
  startDate: new Date(),
  days: []
};

function initCurrentWeek()
{
    const today=new Date();
    const dayOfWeek=today.getDay();
    const diffToMonday=dayOfWeek===0?-6:1-dayOfWeek;

    currentWeek.startDate=new Date(today);
    currentWeek.startDate.setDate(today.getDate()+diffToMonday+1);
    currentWeek.startDate.setHours(0,0,0,0);

    updateWeekDates();
    updateWeekDisplay();
    updateCellDates();


}

function updateWeekDates()
{
    currentWeek.days=[];
    const daysOfWeek=['mon','tue','wed','thu','fri','sat','sun'];

    for (let i=0;i<7;i++)
    {
        const date=new Date(currentWeek.startDate);
        date.setDate(currentWeek.startDate.getDate()+i);
        currentWeek.days.push({
            date:date.toISOString().split('T')[0],
            day:daysOfWeek[i],
            dayName:['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'][i]
        });
    }
}

function formatDate(dateStr)
{
    const [year,month,day]=dateStr.split('-');
    return `${day}.${month}.${year}`;
}

function updateWeekDisplay()
{
    const start=currentWeek.days[0].date;
    const end=currentWeek.days[6].date;
    document.getElementById('current-week-range').textContent=
        `${formatDate(start)}-${formatDate(end)}`;
}



async function updateCellDates() {
  currentWeek.days.forEach(dayInfo => {
    const cells = document.querySelectorAll(`[data-day="${dayInfo.day}"]`);
    cells.forEach(cell => {
      cell.setAttribute('data-date', dayInfo.date);
      let data_time=cell.getAttribute('data-time')
      cell.title = `${formatDate(dayInfo.date)}\n${data_time}:00`;
    });
  });

  // Загружаем события с сервера для новой недели
    await loadEventsForWeek();
}

function goToNextWeek()
{
    currentWeek.startDate.setDate(currentWeek.startDate.getDate()+7)
    updateWeekDates();
    updateWeekDisplay();
    updateCellDates();
}

function goToPrevWeek()
{
    currentWeek.startDate.setDate(currentWeek.startDate.getDate()-7)
    updateWeekDates();
    updateWeekDisplay();
    updateCellDates();
}

export {initCurrentWeek, goToPrevWeek, goToNextWeek,currentWeek};



