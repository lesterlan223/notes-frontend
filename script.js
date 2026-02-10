// ========== ЗАЩИТА ОТ ДВОЙНОЙ ЗАГРУЗКИ ==========
if (window.__notesAppLoaded) {
    console.warn('Notes app already loaded, skipping...');
    throw new Error('Script loaded twice, stopping execution');
}
window.__notesAppLoaded = true;

// ==================== КОНФИГУРАЦИЯ ====================
const API_CONFIG = {
    BASE_URL: 'https://notes-backend-production-1d9a.up.railway.app/api',
    ENDPOINTS: {
        NOTES: '/notes',
        IMPORTANT: '/notes/important'
    }
};

console.log('Notes App Script Loaded! API:', API_CONFIG.BASE_URL);

// ==================== DOM ЭЛЕМЕНТЫ ====================
const elements = {
    notesContainer: document.getElementById('notesContainer'),
    noteForm: document.getElementById('noteForm'),
    noteTitle: document.getElementById('noteTitle'),
    noteContent: document.getElementById('noteText'),
    noteTags: document.getElementById('noteTags'),
    noteImportant: document.getElementById('noteImportant'),
    searchInput: document.getElementById('searchInput'),
    sortSelect: document.getElementById('sortSelect'),
    saveBtn: document.getElementById('saveBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    closeModal: document.getElementById('closeModal'),
    noteModal: document.getElementById('noteModal'),
    newNoteBtn: document.getElementById('newNoteBtn'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    filterBtns: document.querySelectorAll('.filter-btn'),
    themeToggle: document.getElementById('themeToggle')
};

// Проверяем какие элементы найдены
console.log('Найденные элементы:');
Object.keys(elements).forEach(key => {
    console.log(`  ${key}:`, elements[key] ? '✓' : '✗');
});

// ==================== СОСТОЯНИЕ ====================
let appState = {
    notes: [],
    filteredNotes: [],
    isEditing: false,
    currentNoteId: null,
    filter: 'all',
    sortBy: '',
    searchQuery: ''
};

// ==================== API ФУНКЦИИ ====================
const api = {
    getAllNotes: async () => {
        try {
            console.log('Загружаем заметки с:', `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.NOTES}`);
            const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.NOTES}`, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('Статус ответа:', response.status);
            
            if (!response.ok) {
                throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Получены заметки:', data);
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error('Ошибка при загрузке заметок:', error);
            showNotification('Ошибка загрузки заметок. Проверьте консоль.', 'error');
            return [];
        }
    },

    createNote: async (noteData) => {
        try {
            console.log('Создаем заметку:', noteData);
            const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.NOTES}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(noteData)
            });
            
            if (!response.ok) {
                throw new Error(`Ошибка сервера: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Заметка создана:', result);
            return result;
        } catch (error) {
            console.error('Ошибка при создании заметки:', error);
            throw error;
        }
    },

    updateNote: async (id, noteData) => {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.NOTES}/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(noteData)
            });
            
            if (!response.ok) {
                throw new Error(`Ошибка сервера: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка при обновлении заметки:', error);
            throw error;
        }
    },

    deleteNote: async (id) => {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.NOTES}/${id}`, {
                method: 'DELETE',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Ошибка сервера: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка при удалении заметки:', error);
            throw error;
        }
    },

    toggleImportance: async (id, important) => {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.NOTES}/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ important })
            });
            
            if (!response.ok) {
                throw new Error(`Ошибка сервера: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Ошибка при изменении важности:', error);
            throw error;
        }
    }
};

// ==================== ОТОБРАЖЕНИЕ ЗАМЕТОК ====================
function renderNotes(notes) {
    console.log('Рендерим заметки:', notes.length);
    
    if (!elements.notesContainer) {
        console.error('Контейнер notesContainer не найден!');
        return;
    }
    
    if (notes.length === 0) {
        elements.notesContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-sticky-note"></i>
                <p>Нет заметок. Создайте первую!</p>
            </div>
        `;
        return;
    }
    
    elements.notesContainer.innerHTML = notes.map(note => `
        <div class="note ${note.important ? 'important' : ''}" data-id="${note.id}">
            <div class="note-header">
                <h3>${escapeHtml(note.title || 'Без названия')}</h3>
                <div class="note-actions">
                    <button class="icon-btn edit-btn" title="Редактировать">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="icon-btn delete-btn" title="Удалить">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="icon-btn important-toggle ${note.important ? 'active' : ''}" title="${note.important ? 'Снять важность' : 'Пометить важной'}">
                        <i class="fas fa-star"></i>
                    </button>
                </div>
            </div>
            <div class="note-content">
                <p>${escapeHtml(note.content || '').replace(/\n/g, '<br>')}</p>
            </div>
            ${note.tags && note.tags.trim() ? `
                <div class="note-tags">
                    ${note.tags.split(',').map(tag => 
                        `<span class="tag">${escapeHtml(tag.trim())}</span>`
                    ).join('')}
                </div>
            ` : ''}
            <div class="note-footer">
                <small>ID: ${note.id} • Создано: ${formatDate(note.created_at)}</small>
                ${note.important ? '<span class="important-badge">★ Важная</span>' : ''}
            </div>
        </div>
    `).join('');
    
    // Добавляем обработчики
    addNoteEventListeners();
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return 'сегодня';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return dateString;
    }
}

function showNotification(message, type = 'info') {
    console.log(`Уведомление [${type}]:`, message);
    
    // Простое уведомление через alert для начала
    if (type === 'error') {
        alert('❌ ' + message);
    } else if (type === 'success') {
        alert('✅ ' + message);
    } else {
        alert('ℹ️ ' + message);
    }
}

// ==================== МОДАЛЬНОЕ ОКНО ====================
function openNewModal() {
    console.log('Открываем модалку для новой заметки');
    
    if (!elements.noteModal) {
        console.error('Модальное окно не найдено!');
        return;
    }
    
    appState.isEditing = false;
    appState.currentNoteId = null;
    
    if (elements.noteTitle) elements.noteTitle.value = '';
    if (elements.noteContent) elements.noteContent.value = '';
    if (elements.noteTags) elements.noteTags.value = '';
    if (elements.noteImportant) elements.noteImportant.checked = false;
    
    const modalTitle = document.querySelector('#modalTitle');
    if (modalTitle) modalTitle.textContent = 'Новая заметка';
    
    const saveBtn = elements.saveBtn;
    if (saveBtn) saveBtn.textContent = 'Создать заметку';
    
    elements.noteModal.style.display = 'block';
}

function openEditModal(note) {
    console.log('Редактируем заметку:', note.id);
    
    appState.isEditing = true;
    appState.currentNoteId = note.id;
    
    if (elements.noteTitle) elements.noteTitle.value = note.title || '';
    if (elements.noteContent) elements.noteContent.value = note.content || '';
    if (elements.noteTags) elements.noteTags.value = note.tags || '';
    if (elements.noteImportant) elements.noteImportant.checked = Boolean(note.important);
    
    const modalTitle = document.querySelector('#modalTitle');
    if (modalTitle) modalTitle.textContent = 'Редактировать заметку';
    
    const saveBtn = elements.saveBtn;
    if (saveBtn) saveBtn.textContent = 'Обновить заметку';
    
    elements.noteModal.style.display = 'block';
}

function closeModal() {
    if (elements.noteModal) {
        elements.noteModal.style.display = 'none';
    }
}

// ==================== ОБРАБОТЧИКИ СОБЫТИЙ ====================
function addNoteEventListeners() {
    // Кнопки редактирования
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const noteElement = e.target.closest('.note');
            const noteId = noteElement.dataset.id;
            const note = appState.filteredNotes.find(n => n.id == noteId);
            if (note) {
                openEditModal(note);
            }
        });
    });
    
    // Кнопки удаления
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const noteElement = e.target.closest('.note');
            const noteId = noteElement.dataset.id;
            
            if (confirm('Вы уверены, что хотите удалить эту заметку?')) {
                try {
                    await api.deleteNote(noteId);
                    showNotification('Заметка удалена', 'success');
                    await loadNotes();
                } catch (error) {
                    showNotification('Ошибка при удалении', 'error');
                }
            }
        });
    });
    
    // Переключение важности
    document.querySelectorAll('.important-toggle').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const noteElement = e.target.closest('.note');
            const noteId = noteElement.dataset.id;
            const note = appState.filteredNotes.find(n => n.id == noteId);
            
            if (note) {
                try {
                    await api.toggleImportance(noteId, !note.important);
                    showNotification(note.important ? 'Снята важность' : 'Отмечена как важная', 'success');
                    await loadNotes();
                } catch (error) {
                    showNotification('Ошибка при изменении важности', 'error');
                }
            }
        });
    });
}

// ==================== ФИЛЬТРАЦИЯ И ПОИСК ====================
function applyFiltersAndSort() {
    console.log('Применяем фильтры и сортировку');
    
    let result = [...appState.notes];
    
    // Фильтр по важности
    if (appState.filter === 'important') {
        result = result.filter(note => note.important);
    }
    
    // Поиск
    if (appState.searchQuery) {
        const query = appState.searchQuery.toLowerCase();
        result = result.filter(note => {
            return (
                (note.title && note.title.toLowerCase().includes(query)) ||
                (note.content && note.content.toLowerCase().includes(query)) ||
                (note.tags && note.tags.toLowerCase().includes(query))
            );
        });
    }
    
    // Сортировка
    if (appState.sortBy === 'newest') {
        result.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } else if (appState.sortBy === 'oldest') {
        result.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    } else if (appState.sortBy === 'alpha-asc') {
        result.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else if (appState.sortBy === 'alpha-desc') {
        result.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
    } else if (appState.sortBy === 'important') {
        result.sort((a, b) => (b.important || false) - (a.important || false));
    }
    
    appState.filteredNotes = result;
    renderNotes(result);
}

// ==================== СОХРАНЕНИЕ ЗАМЕТКИ ====================
async function saveNote() {
    console.log('Сохранение заметки...');
    
    if (!elements.noteTitle || !elements.noteContent) {
        showNotification('Ошибка: поля формы не найдены', 'error');
        return;
    }
    
    const noteData = {
        title: elements.noteTitle.value.trim(),
        content: elements.noteContent.value.trim(),
        tags: elements.noteTags ? elements.noteTags.value.trim() : '',
        important: elements.noteImportant ? elements.noteImportant.checked : false
    };
    
    console.log('Данные для сохранения:', noteData);
    
    if (!noteData.title || !noteData.content) {
        showNotification('Заполните заголовок и текст заметки', 'error');
        return;
    }
    
    try {
        if (appState.isEditing && appState.currentNoteId) {
            await api.updateNote(appState.currentNoteId, noteData);
            showNotification('Заметка обновлена успешно!', 'success');
        } else {
            await api.createNote(noteData);
            showNotification('Заметка создана успешно!', 'success');
        }
        
        closeModal();
        await loadNotes();
        
    } catch (error) {
        console.error('Ошибка при сохранении:', error);
        showNotification('Ошибка при сохранении: ' + error.message, 'error');
    }
}

// ==================== ЗАГРУЗКА ЗАМЕТОК ====================
async function loadNotes() {
    console.log('Загрузка заметок...');
    try {
        const notes = await api.getAllNotes();
        appState.notes = notes;
        console.log('Заметки загружены:', notes.length);
        applyFiltersAndSort();
    } catch (error) {
        console.error('Ошибка при загрузке заметок:', error);
    }
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
function initEventListeners() {
    console.log('Инициализация обработчиков событий...');
    
    // Кнопка новой заметки
    if (elements.newNoteBtn) {
        elements.newNoteBtn.addEventListener('click', openNewModal);
        console.log('Кнопка новой заметки подключена');
    }
    
    // Сохранение заметки
    if (elements.saveBtn) {
        elements.saveBtn.addEventListener('click', saveNote);
        console.log('Кнопка сохранения подключена');
    }
    
    // Закрытие модального окна
    if (elements.cancelBtn) {
        elements.cancelBtn.addEventListener('click', closeModal);
    }
    
    if (elements.closeModal) {
        elements.closeModal.addEventListener('click', closeModal);
    }
    
    // Клик вне модального окна
    window.addEventListener('click', (e) => {
        if (e.target === elements.noteModal) {
            closeModal();
        }
    });
    
    // Поиск
    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', (e) => {
            appState.searchQuery = e.target.value;
            applyFiltersAndSort();
        });
    }
    
    // Сортировка
    if (elements.sortSelect) {
        elements.sortSelect.addEventListener('change', (e) => {
            appState.sortBy = e.target.value;
            applyFiltersAndSort();
        });
    }
    
    // Фильтры
    if (elements.filterBtns) {
        elements.filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                elements.filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                appState.filter = btn.dataset.filter;
                applyFiltersAndSort();
            });
        });
    }
    
    // Очистка всех заметок
    if (elements.clearAllBtn) {
        elements.clearAllBtn.addEventListener('click', async () => {
            if (appState.notes.length === 0) {
                showNotification('Нет заметок для удаления', 'info');
                return;
            }
            
            if (confirm(`Удалить ВСЕ заметки (${appState.notes.length} шт.)? Это действие нельзя отменить!`)) {
                try {
                    showNotification('Удаление всех заметок...', 'info');
                    
                    // Удаляем каждую заметку по отдельности
                    for (const note of appState.notes) {
                        await api.deleteNote(note.id);
                        console.log('Удалена заметка:', note.id);
                    }
                    
                    showNotification('Все заметки удалены', 'success');
                    await loadNotes();
                } catch (error) {
                    console.error('Ошибка при удалении всех заметок:', error);
                    showNotification('Ошибка при удалении заметок', 'error');
                }
            }
        });
    }
    
    // Тема
    if (elements.themeToggle) {
        elements.themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');
            const icon = elements.themeToggle.querySelector('i');
            if (icon) {
                if (document.body.classList.contains('dark-theme')) {
                    icon.className = 'fas fa-sun';
                    elements.themeToggle.innerHTML = '<i class="fas fa-sun"></i> Светлая';
                } else {
                    icon.className = 'fas fa-moon';
                    elements.themeToggle.innerHTML = '<i class="fas fa-moon"></i> Темная';
                }
            }
        });
    }
    
    // Горячие клавиши
    document.addEventListener('keydown', (e) => {
        // Ctrl+B - новая заметка
        if (e.ctrlKey && e.key === 'b') {
            e.preventDefault();
            openNewModal();
        }
        // Esc - закрыть модалку
        if (e.key === 'Escape' && elements.noteModal.style.display === 'block') {
            closeModal();
        }
        // Ctrl+Q - сохранить (в модалке)
        if (e.ctrlKey && e.key === 'q' && elements.noteModal.style.display === 'block') {
            e.preventDefault();
            saveNote();
        }
    });
    
    console.log('Обработчики событий инициализированы');
}

// ==================== ОСНОВНАЯ ИНИЦИАЛИЗАЦИЯ ====================
async function initApp() {
    console.log('====== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ======');
    
    try {
        // Инициализируем обработчики
        initEventListeners();
        
        // Загружаем заметки
        await loadNotes();
        
        console.log('Приложение успешно инициализировано!');
        console.log('Используйте в консоли:');
        console.log('  - app.loadNotes() - перезагрузить заметки');
        console.log('  - app.api - методы API');
        console.log('  - app.appState - состояние приложения');
        
        showNotification('Приложение загружено!', 'success');
        
    } catch (error) {
        console.error('Критическая ошибка при инициализации:', error);
        showNotification('Ошибка инициализации приложения', 'error');
    }
}

// ==================== ЭКСПОРТ ДЛЯ ОТЛАДКИ ====================
window.app = {
    loadNotes,
    api,
    appState,
    openNewModal,
    saveNote,
    closeModal
};

// ==================== ЗАПУСК ПРИЛОЖЕНИЯ ====================
// Ждем полной загрузки DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    // Если DOM уже загружен, запускаем сразу
    setTimeout(initApp, 100);
}

console.log('Notes App Script Загружен!');
