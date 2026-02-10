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
    clearAllBtn: document.getElementById('clearAllBtn')
};

// Проверяем какие элементы найдены
console.log('Найденные элементы:');
for (const key in elements) {
    console.log(`  ${key}:`, elements[key] ? '✓' : '✗');
}

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
async function fetchNotes() {
    try {
        console.log('Загружаем заметки...');
        const response = await fetch(CONFIG.API_URL);
        
        if (!response.ok) {
            throw new Error(`Ошибка ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Получены заметки:', data.length || data);
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error('Ошибка при загрузке заметок:', error);
        alert('❌ Ошибка загрузки заметок. Проверьте консоль.');
        return [];
    }
}

async function saveNoteToAPI(noteData) {
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

async function deleteNoteFromAPI(id) {
    try {
        const response = await fetch(`${CONFIG.API_URL}/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error(`Ошибка ${response.status}: ${response.statusText}`);
        }
        
        return true;
    } catch (error) {
        console.error('Ошибка при удалении:', error);
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
                    <button class="btn-edit" title="Редактировать">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-delete" title="Удалить">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="btn-important ${note.important ? 'active' : ''}" 
                            title="${note.important ? 'Снять важность' : 'Пометить важной'}">
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
                <small>Создано: ${formatDate(note.created_at)}</small>
                ${note.important ? '<span class="important-badge">★ Важная</span>' : ''}
            </div>
        </div>
    `).join('');
    
    // Добавляем обработчики событий
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
            year: 'numeric'
        });
    } catch {
        return dateString;
    }
}

function showNotification(message, type = 'info') {
    console.log(`Уведомление [${type}]:`, message);
    alert(type === 'error' ? '❌ ' + message : '✅ ' + message);
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

function closeModal() {
    if (elements.noteModal) {
        elements.noteModal.style.display = 'none';
    }
}

// ==================== ОБРАБОТЧИКИ СОБЫТИЙ ДЛЯ ЗАМЕТОК ====================
function addNoteEventListeners() {
    // Редактирование
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const noteElement = e.target.closest('.note');
            const noteId = noteElement.dataset.id;
            const note = appState.filteredNotes.find(n => n.id == noteId);
            
            if (note) {
                // Открываем форму для редактирования
                appState.isEditing = true;
                appState.currentNoteId = note.id;
                
                elements.noteTitle.value = note.title || '';
                elements.noteContent.value = note.content || '';
                elements.noteTags.value = note.tags || '';
                elements.noteImportant.checked = Boolean(note.important);
                
                document.querySelector('#modalTitle').textContent = 'Редактировать заметку';
                elements.saveBtn.textContent = 'Обновить заметку';
                
                elements.noteModal.style.display = 'block';
            }
        });
    });
    
    // Удаление
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const noteElement = e.target.closest('.note');
            const noteId = noteElement.dataset.id;
            
            if (confirm('Удалить заметку?')) {
                try {
                    await deleteNoteFromAPI(noteId);
                    showNotification('Заметка удалена', 'success');
                    await loadNotes();
                } catch (error) {
                    showNotification('Ошибка при удалении', 'error');
                }
            }
        });
    });
    
    // Важность
    document.querySelectorAll('.btn-important').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const noteElement = e.target.closest('.note');
            const noteId = noteElement.dataset.id;
            const note = appState.filteredNotes.find(n => n.id == noteId);
            
            if (note) {
                try {
                    const response = await fetch(`${CONFIG.API_URL}/${noteId}`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ important: !note.important })
                    });
                    
                    if (!response.ok) throw new Error('Ошибка сервера');
                    
                    showNotification(note.important ? 'Снята важность' : 'Отмечена как важная', 'success');
                    await loadNotes();
                } catch (error) {
                    showNotification('Ошибка при изменении важности', 'error');
                }
            }
        });
    });
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
    
    if (appState.isEditing && appState.currentNoteId) {
        noteData.id = appState.currentNoteId;
    }
    
    console.log('Данные для сохранения:', noteData);
    
    if (!noteData.title || !noteData.content) {
        showNotification('Заполните заголовок и текст заметки', 'error');
        return;
    }
    
    try {
        await saveNoteToAPI(noteData);
        showNotification(
            appState.isEditing ? 'Заметка обновлена!' : 'Заметка создана!', 
            'success'
        );
        
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
    appState.notes = await fetchNotes();
    appState.filteredNotes = [...appState.notes];
    renderNotes(appState.filteredNotes);
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
async function initApp() {
    console.log('====== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ======');
    
    try {
        // Кнопка новой заметки
        if (elements.newNoteBtn) {
            elements.newNoteBtn.addEventListener('click', openNewModal);
            console.log('Кнопка "Создать" подключена');
        }
        
        // Сохранение заметки
        if (elements.saveBtn) {
            elements.saveBtn.addEventListener('click', saveNote);
            console.log('Кнопка "Сохранить" подключена');
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
                const query = e.target.value.toLowerCase();
                appState.filteredNotes = appState.notes.filter(note => 
                    (note.title && note.title.toLowerCase().includes(query)) ||
                    (note.content && note.content.toLowerCase().includes(query)) ||
                    (note.tags && note.tags.toLowerCase().includes(query))
                );
                renderNotes(appState.filteredNotes);
            });
        }
        
        // Сортировка
        if (elements.sortSelect) {
            elements.sortSelect.addEventListener('change', (e) => {
                const sortBy = e.target.value;
                let sorted = [...appState.filteredNotes];
                
                if (sortBy === 'newest') {
                    sorted.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
                } else if (sortBy === 'oldest') {
                    sorted.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
                } else if (sortBy === 'alpha-asc') {
                    sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
                } else if (sortBy === 'alpha-desc') {
                    sorted.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
                } else if (sortBy === 'important') {
                    sorted.sort((a, b) => (b.important || false) - (a.important || false));
                }
                
                renderNotes(sorted);
            });
        }
        
        // Фильтры
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Убрать активный класс у всех
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                // Добавить активный класс текущему
                btn.classList.add('active');
                
                const filter = btn.dataset.filter;
                
                if (filter === 'all') {
                    appState.filteredNotes = [...appState.notes];
                } else if (filter === 'important') {
                    appState.filteredNotes = appState.notes.filter(note => note.important);
                } else if (filter === 'deleted') {
                    // Для корзины - если у вас есть поле deleted
                    appState.filteredNotes = appState.notes.filter(note => note.deleted);
                }
                
                renderNotes(appState.filteredNotes);
            });
        });
        
        // Очистка всех заметок
        if (elements.clearAllBtn) {
            elements.clearAllBtn.addEventListener('click', async () => {
                if (appState.notes.length === 0) {
                    showNotification('Нет заметок для удаления', 'info');
                    return;
                }
                
                if (confirm(`Удалить ВСЕ заметки (${appState.notes.length} шт.)? Это действие нельзя отменить!`)) {
                    try {
                        // Удаляем каждую заметку по отдельности
                        for (const note of appState.notes) {
                            await deleteNoteFromAPI(note.id);
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
        
        // Загрузка заметок при старте
        await loadNotes();
        
        console.log('Приложение успешно инициализировано!');
        
    } catch (error) {
        console.error('Критическая ошибка при инициализации:', error);
        alert('❌ Ошибка инициализации приложения');
    }
}

// ==================== ЗАПУСК ПРИЛОЖЕНИЯ ====================
// Ждем полной загрузки DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    // Если DOM уже загружен, запускаем сразу
    setTimeout(initApp, 100);
}

console.log('Notes App Script Загружен!');
