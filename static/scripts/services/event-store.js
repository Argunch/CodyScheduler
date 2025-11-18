// stores/event-store.js
class EventStore {
    constructor() {
        this.events = new Map(); // Все события по ID
        this.currentEvent = null; // Текущее редактируемое событие
        this.subscribers = new Set(); // Подписчики на изменения
    }

    // СОХРАНИТЬ события из API
    setEvents(apiEvents) {
        this.events.clear();
        apiEvents.forEach(event => {
            // Нормализуем данные и гарантируем все поля
            const normalizedEvent = this.normalizeEvent(event);
            this.events.set(normalizedEvent.id, normalizedEvent);
        });
        this.notifySubscribers();
    }

    // ДОБАВИТЬ/ОБНОВИТЬ одно событие
    setEvent(eventData) {
        const normalizedEvent = this.normalizeEvent(eventData);
        this.events.set(normalizedEvent.id, normalizedEvent);
        this.notifySubscribers();
        return normalizedEvent;
    }

    // УДАЛИТЬ событие
    removeEvent(eventId) {
        this.events.delete(eventId);
        if (this.currentEvent?.id === eventId) {
            this.currentEvent = null;
        }
        this.notifySubscribers();
    }

    // УСТАНОВИТЬ текущее событие (для редактирования)
    setCurrentEvent(event) {
        this.currentEvent = event ? { ...event } : null; // глубокое копирование
        this.notifySubscribers();
    }

    // ПОЛУЧИТЬ событие по ID
    getEvent(id) {
        return this.events.get(id);
    }

    // ПОЛУЧИТЬ все события
    getAllEvents() {
        return Array.from(this.events.values());
    }

    // ПОИСК по series_id
    getEventsBySeries(seriesId) {
        return this.getAllEvents().filter(event => event.series_id === seriesId);
    }

    // НОРМАЛИЗАЦИЯ данных события (решает проблему с series_id!)
    normalizeEvent(eventData) {
        return {
            id: eventData.id,
            series_id: eventData.series_id || null, // ← ГАРАНТИРУЕМ что поле есть
            date: eventData.date,
            time: eventData.time,
            text: eventData.text || '',
            color: eventData.color || 'blue',
            is_recurring: Boolean(eventData.is_recurring),
            duration: parseFloat(eventData.duration) || 1.0,
            created_by: eventData.created_by || null,
            canEdit: Boolean(eventData.canEdit),
            // Дополнительные поля из API
            ...eventData
        };
    }

    // ПОДПИСКА на изменения
    subscribe(callback) {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    // УВЕДОМЛЕНИЕ подписчиков
    notifySubscribers() {
        this.subscribers.forEach(callback => callback());
    }
}

export const eventStore = new EventStore();