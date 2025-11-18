// ЕДИНАЯ СТРУКТУРА СОБЫТИЯ
export const EVENT_STRUCTURE = {
    // Основные поля
    id: null,
    series_id: null,
    date: '',
    time: '',
    text: '',
    color: 'blue',
    is_recurring: false,
    duration: 1.0,
    created_by: null,
    user_id: null,
    target_user_id: null,
    canEdit: false,
    
    // Дополнительные поля
    overlay: null,
    startMinutes: 0
};

// МАППИНГ ДЛЯ DATA-АТРИБУТОВ
export const DATA_ATTRIBUTE_MAPPING = {
    'data-id': 'id',
    'data-series-id': 'series_id',
    'data-date': 'date', 
    'data-time': 'time',
    'data-color': 'color',
    'data-recurring': 'is_recurring',
    'data-duration': 'duration',
    'data-created-by': 'created_by',
    'data-user-id': 'user_id',
    'data-target-user-id': 'target_user_id',
    'data-can-edit': 'canEdit',
    'data-start-minutes': 'startMinutes'
};


// КОНСТАНТЫ ДЛЯ КЛЮЧЕЙ (для обратной совместимости)
export const EVENT_FIELDS = {
    ID: 'id',
    SERIES_ID: 'series_id',
    DATE: 'date',
    TIME: 'time', 
    TEXT: 'text',
    COLOR: 'color',
    IS_RECURRING: 'is_recurring',
    DURATION: 'duration',
    CREATED_BY: 'created_by',
    USER_ID: 'user_id',
    TARGET_USER_ID: 'target_user_id',
    CAN_EDIT: 'canEdit',

    OVERLAY: 'overlay',
    START_MINUTES: 'startMinutes'
};


// КОНСТАНТЫ ДЛЯ DATA-АТРИБУТОВ (для обратной совместимости)  
export const DATA_ATTRIBUTES = {
    ID: 'data-id',
    SERIES_ID: 'data-series-id',
    DATE: 'data-date',
    TIME: 'data-time',
    COLOR: 'data-color',
    RECURRING: 'data-recurring',
    DURATION: 'data-duration',
    CREATED_BY: 'data-created-by',
    USER_ID: 'data-user-id',
    TARGET_USER_ID: 'data-target-user-id',
    CAN_EDIT: 'data-can-edit',
    START_MINUTES: 'data-start-minutes'
};