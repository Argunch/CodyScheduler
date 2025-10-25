export const EVENT_FIELDS={
    ID: 'id',
    DATE: 'date',
    TIME: 'time',
    IS_RECURRING: 'is_recurring',
    DURATION: 'duration',
    COLOR: 'color',
    TEXT: 'text',
    OVERLAY: 'overlay',
    CREATED_BY: 'created_by', // ← ДОБАВЛЕНО
    CAN_EDIT: 'canEdit' // ← ДОБАВЛЕНО
}

export const EVENT_DEFAULTS={
    COLOR: 'blue',
    DURATION: 1.0,
    IS_RECURRING: false,
}

export const DATA_ATTRIBUTES={
    ID: 'data-id',
    DATE: 'data-date',
    TIME: 'data-time',
    DURATION: 'data-duration',
    COLOR: 'data-color',
    RECURRING: 'data-recurring',
    CREATED_BY: 'data-created-by', // ← ДОБАВЛЕНО
    CAN_EDIT: 'data-can-edit' // ← ДОБАВЛЕНО
}