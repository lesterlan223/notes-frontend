// ========== ЗАЩИТА ОТ ДВОЙНОЙ ЗАГРУЗКИ ==========
if (window.__notesAppLoaded) {
    console.warn('Notes app already loaded, skipping...');
    return;
}
window.__notesAppLoaded = true;

// ==================== КОНФИГУРАЦИЯ ====================
const CONFIG = {
    API_URL: 'https://notes-backend-production-1d9a.up.railway.app/api/notes'
};

console.log('Notes App Script Loaded! API:', CONFIG.API_URL);

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
    themeToggle: document.getElementById('themeToggle'),
    exportBtn: document.getElementById('exportBtn'),
    importBtn: document.getElementById('importBtn'),
    filterBtns: document.querySelectorAll('.filter-btn')
};

// Проверяем какие элементы найдены
console.log('Найденные элементы:');
Object.keys(elements).forEach(key => {
    if (elements[key]) {
        console.log(`  ${key}: ✓`);
    }
});

// ==================== СОСТОЯНИЕ ====================
let appState = {
    notes: [],
    filteredNotes: [],
    isEditing: false,
    currentNoteId: null,
    filter: 'all',
    sortBy: '',
    searchQuery: '',
    theme: 'light'
};

// ==================== API ФУНКЦИИ ====================
async function fetchNotes() {
    try {
        console.log('Загружаем заметки из:', CONFIG.API_URL);
        const response = await fetch(CONFIG.API_URL);
        
        if (!response.ok) {
            throw new Error(`Ошибка ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Получены заметок:', data.length);
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error('Ошибка при загрузке заметок:', error);
        showAlert('❌ Ошибка загрузки заметок. Проверьте консоль.', 'error');
        return [];
    }
}

async function saveNoteAPI(noteData) {
    try {
        const url = noteData.id 
            ? `${CONFIG.API_URL}/${noteData.id}`
            : CONFIG.API_URL;
            
        const method = noteData.id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title: noteData.title,
                content: noteData.content,
                tags: noteData.tags || '',
                important: noteData.important || false
            })
        });
        
        if (!response.ok) {
            throw new Error(`Ошибка ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('Заметка сохранена:', result);
        return result;
    } catch (error) {
        console.error('Ошибка при сохранении:', error);
        throw error;
    }
}

async function deleteNoteAPI(id) {
    try {
        console.log('Удаляем заметку ID:', id);
        
        const response = await fetch(`${CONFIG.API_URL}/${id}`, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Статус ответа:', response.status);
        
        if (response.status === 200 || response.status === 204) {
            console.log('Заметка удалена успешно');
            return true;
        }
        
        // Пробуем получить текст ошибки
        const errorText = await response.text();
        console.error('Ошибка удаления:', errorText);
        
        // Проверяем, может быть бэкенд ожидает другой формат
        if (response.status === 404) {
            throw new Error('Заметка не найдена');
        } else if (response.status === 401) {
            throw new Error('Ошибка авторизации');
        } else {
            throw new Error(`Ошибка сервера: ${response.status} - ${errorText}`);
        }
        
    } catch (error) {
        console.error('Ошибка при удалении:', error);
        throw error;
    }
}

async function toggleImportanceAPI(id, important) {
    try {
        const response = await fetch(`${CONFIG.API_URL}/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ important })
        });
        
        if (!response.ok) {
            throw new Error(`Ошибка ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Ошибка при изменении важности:', error);
        throw error;
    }
}

// ==================== ОТОБРАЖЕНИЕ ЗАМЕТОК ====================
function renderNotes(notes) {
    console.log('Рендерим заметки:', notes.length);
    
    if (!elements.notesContainer) {
        console.error('Контейнер notesContainer не найден!');
        return;
    }
    
    if (notes.length === 0) {
        elements.notesContainer.innerHTML = `
            <div class="empty">
                <i class="fas fa-sticky-note"></i>
                <h3>Нет заметок</h3>
                <p>Создайте первую заметку!</p>
            </div>
        `;
        return;
    }
    
    elements.notesContainer.innerHTML = notes.map(note => `
        <div class="note ${note.important ? 'important' : ''}" data-id="${note.id}">
            <div class="note-header">
                <h3 class="note-title">
                    ${escapeHtml(note.title || 'Без названия')}
                    ${note.important ? '<i class="fas fa-star note-important"></i>' : ''}
                </h3>
                <div class="note-actions">
                    <button class="note-btn edit" title="Редактировать">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="note-btn important-btn" title="${note.important ? 'Снять важность' : 'Пометить важной'}">
                        <i class="fas fa-star ${note.important ? 'active' : ''}"></i>
                    </button>
                    <button class="note-btn delete" title="Удалить">
                        <i class="fas fa-trash"></i>
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
                <small class="note-date">ID: ${note.id} • Создано: ${formatDate(note.created_at)}</small>
            </div>
        </div>
    `).join('');
    
    // Добавляем обработчики событий
    setupNoteEventListeners();
}

// ==================== ОБРАБОТЧИКИ СОБЫТИЙ ДЛЯ ЗАМЕТОК ====================
function setupNoteEventListeners() {
    // Редактирование
    document.querySelectorAll('.note-btn.edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const noteElement = e.target.closest('.note');
            const noteId = parseInt(noteElement.dataset.id);
            const note = appState.filteredNotes.find(n => n.id === noteId);
            
            if (note) {
                openEditModal(note);
            }
        });
    });
    
    // Удаление
    document.querySelectorAll('.note-btn.delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const noteElement = e.target.closest('.note');
            const noteId = parseInt(noteElement.dataset.id);
            
            if (confirm('Вы уверены, что хотите удалить эту заметку?')) {
                try {
                    await deleteNoteAPI(noteId);
                    showAlert('✅ Заметка удалена', 'success');
                    await loadNotes();
                } catch (error) {
                    showAlert('❌ Ошибка при удалении', 'error');
                }
            }
        });
    });
    
    // Переключение важности
    document.querySelectorAll('.note-btn.important-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const noteElement = e.target.closest('.note');
            const noteId = parseInt(noteElement.dataset.id);
            const note = appState.filteredNotes.find(n => n.id === noteId);
            
            if (note) {
                try {
                    await toggleImportanceAPI(noteId, !note.important);
                    showAlert(
                        note.important ? '✅ Снята важность' : '✅ Отмечена как важная', 
                        'success'
                    );
                    await loadNotes();
                } catch (error) {
                    showAlert('❌ Ошибка при изменении важности', 'error');
                }
            }
        });
    });
    
    // Клик по заметке (для мобильных)
    document.querySelectorAll('.note').forEach(note => {
        note.addEventListener('click', (e) => {
            // Не открываем, если кликнули по кнопке
            if (e.target.closest('.note-btn')) {
                return;
            }
            
            const noteId = parseInt(note.dataset.id);
            const noteData = appState.filteredNotes.find(n => n.id === noteId);
            
            if (noteData) {
                openEditModal(noteData);
            }
        });
    });
}

// ==================== МОДАЛЬНОЕ ОКНО ====================
function openNewModal() {
    console.log('Открываем модалку для новой заметки');
    
    appState.isEditing = false;
    appState.currentNoteId = null;
    
    // Сбрасываем форму
    elements.noteTitle.value = '';
    elements.noteContent.value = '';
    elements.noteTags.value = '';
    elements.noteImportant.checked = false;
    
    // Меняем заголовок и текст кнопки
    document.getElementById('modalTitle').textContent = 'Новая заметка';
    elements.saveBtn.textContent = 'Создать заметку';
    
    // Показываем модалку
    elements.noteModal.style.display = 'block';
    document.body.classList.add('modal-open');
}

function openEditModal(note) {
    console.log('Редактируем заметку:', note.id);
    
    appState.isEditing = true;
    appState.currentNoteId = note.id;
    
    // Заполняем форму
    elements.noteTitle.value = note.title || '';
    elements.noteContent.value = note.content || '';
    elements.noteTags.value = note.tags || '';
    elements.noteImportant.checked = Boolean(note.important);
    
    // Меняем заголовок и текст кнопки
    document.getElementById('modalTitle').textContent = 'Редактировать заметку';
    elements.saveBtn.textContent = 'Обновить заметку';
    
    // Показываем модалку
    elements.noteModal.style.display = 'block';
    document.body.classList.add('modal-open');
}

function closeModal() {
    elements.noteModal.style.display = 'none';
    document.body.classList.remove('modal-open');
}

// ==================== СОХРАНЕНИЕ ЗАМЕТКИ ====================
async function saveNote() {
    console.log('Сохранение заметки...');
    
    const title = elements.noteTitle.value.trim();
    const content = elements.noteContent.value.trim();
    const tags = elements.noteTags.value.trim();
    const important = elements.noteImportant.checked;
    
    if (!title || !content) {
        showAlert('❌ Заполните заголовок и текст заметки', 'error');
        return;
    }
    
    const noteData = {
        title,
        content,
        tags,
        important
    };
    
    if (appState.isEditing && appState.currentNoteId) {
        noteData.id = appState.currentNoteId;
    }
    
    try {
        await saveNoteAPI(noteData);
        
        showAlert(
            appState.isEditing ? '✅ Заметка обновлена!' : '✅ Заметка создана!', 
            'success'
        );
        
        closeModal();
        await loadNotes();
        
    } catch (error) {
        console.error('Ошибка при сохранении:', error);
        showAlert('❌ Ошибка при сохранении: ' + error.message, 'error');
    }
}

// ==================== ФИЛЬТРАЦИЯ И ПОИСК ====================
function applyFilters() {
    let result = [...appState.notes];
    
    // Фильтр по важности
    if (appState.filter === 'important') {
        result = result.filter(note => note.important);
    } else if (appState.filter === 'deleted') {
        // Для корзины (если будет реализовано)
        result = result.filter(note => note.deleted);
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

// ==================== ТЕМА ====================
function initTheme() {
    // Проверяем сохраненную тему
    const savedTheme = localStorage.getItem('notes-theme');
    if (savedTheme) {
        appState.theme = savedTheme;
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
            updateThemeIcon(true);
        }
    }
    
    // Обработчик кнопки темы
    if (elements.themeToggle) {
        elements.themeToggle.addEventListener('click', toggleTheme);
    }
}

function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-theme');
    appState.theme = isDark ? 'dark' : 'light';
    
    // Сохраняем в localStorage
    localStorage.setItem('notes-theme', appState.theme);
    
    // Обновляем иконку
    updateThemeIcon(isDark);
    
    showAlert(`Тема изменена: ${isDark ? 'темная' : 'светлая'}`, 'info');
}

function updateThemeIcon(isDark) {
    if (!elements.themeToggle) return;
    
    if (isDark) {
        elements.themeToggle.innerHTML = '<i class="fas fa-sun"></i> Светлая';
    } else {
        elements.themeToggle.innerHTML = '<i class="fas fa-moon"></i> Темная';
    }
}

// ==================== УВЕДОМЛЕНИЯ ====================
function showAlert(message, type = 'info') {
    console.log(`Уведомление [${type}]:`, message);
    
    // Создаем или находим контейнер для уведомлений
    let container = document.getElementById('notificationArea');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notificationArea';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1001;
        `;
        document.body.appendChild(container);
    }
    
    // Создаем уведомление
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button class="close-notification" style="margin-left: 15px; background: none; border: none; cursor: pointer; color: inherit;">&times;</button>
    `;
    
    container.appendChild(notification);
    
    // Удаление по клику
    notification.querySelector('.close-notification').addEventListener('click', () => {
        notification.remove();
    });
    
    // Автоматическое удаление через 3 секунды
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
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

// ==================== ЗАГРУЗКА ЗАМЕТОК ====================
async function loadNotes() {
    console.log('Загрузка заметок...');
    appState.notes = await fetchNotes();
    applyFilters();
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
function initEventListeners() {
    console.log('Инициализация обработчиков событий...');
    
    // Кнопка новой заметки
    if (elements.newNoteBtn) {
        elements.newNoteBtn.addEventListener('click', openNewModal);
    }
    
    // Сохранение заметки
    if (elements.saveBtn) {
        elements.saveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            saveNote();
        });
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
            applyFilters();
        });
    }
    
    // Сортировка
    if (elements.sortSelect) {
        elements.sortSelect.addEventListener('change', (e) => {
            appState.sortBy = e.target.value;
            applyFilters();
        });
    }
    
    // Фильтры
    if (elements.filterBtns) {
        elements.filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Убрать активный класс у всех
                elements.filterBtns.forEach(b => b.classList.remove('active'));
                // Добавить активный класс текущему
                btn.classList.add('active');
                
                appState.filter = btn.dataset.filter;
                applyFilters();
            });
        });
    }
    
    // Очистка всех заметок
    if (elements.clearAllBtn) {
        elements.clearAllBtn.addEventListener('click', async () => {
            if (appState.notes.length === 0) {
                showAlert('📝 Нет заметок для удаления', 'info');
                return;
            }
            
            if (confirm(`🗑️ Удалить ВСЕ заметки (${appState.notes.length} шт.)? Это действие нельзя отменить!`)) {
                try {
                    // Удаляем каждую заметку по отдельности
                    for (const note of appState.notes) {
                        await deleteNoteAPI(note.id);
                        console.log('Удалена заметка:', note.id);
                    }
                    
                    showAlert('✅ Все заметки удалены', 'success');
                    await loadNotes();
                } catch (error) {
                    console.error('Ошибка при удалении всех заметок:', error);
                    showAlert('❌ Ошибка при удалении заметок', 'error');
                }
            }
        });
    }
    
    // Экспорт/Импорт (заглушки)
    if (elements.exportBtn) {
        elements.exportBtn.addEventListener('click', () => {
            showAlert('📤 Экспорт пока не реализован', 'info');
        });
    }
    
    if (elements.importBtn) {
        elements.importBtn.addEventListener('click', () => {
            showAlert('📥 Импорт пока не реализован', 'info');
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
        // Инициализируем тему
        initTheme();
        
        // Инициализируем обработчики
        initEventListeners();
        
        // Загружаем заметки
        await loadNotes();
        
        console.log('✅ Приложение успешно инициализировано!');
        
    } catch (error) {
        console.error('❌ Критическая ошибка при инициализации:', error);
        showAlert('❌ Ошибка инициализации приложения', 'error');
    }
}

// ==================== ЗАПУСК ПРИЛОЖЕНИЯ ====================
// Ждем полной загрузки DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    setTimeout(initApp, 100);
}

// Экспорт для отладки
window.app = {
    loadNotes,
    saveNote,
    openNewModal,
    closeModal,
    appState,
    CONFIG
};

console.log('📝 Notes App Script Загружен!');
