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

// ==================== DOM ЭЛЕМЕНТЫ (ПОД ВАШ HTML) ====================
const elements = {
  notesContainer: document.getElementById('notesContainer'),
  noteForm: document.getElementById('noteForm'),
  noteTitle: document.getElementById('noteTitle'),
  noteContent: document.getElementById('noteText'), // У вас noteText, а не noteContent!
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
  filterBtns: document.querySelectorAll('.filter-btn')
};

console.log('Найденные элементы:', Object.keys(elements)
  .filter(key => elements[key])
  .map(key => `${key}: ✓`).join(', '));

// ==================== СОСТОЯНИЕ ПРИЛОЖЕНИЯ ====================
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
      console.log('Загружаем заметки...');
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.NOTES}`);
      if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);
      const data = await response.json();
      console.log('Получены заметки:', data.length || data);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Ошибка при загрузке заметок:', error);
      showNotification('Ошибка загрузки заметок', 'error');
      return [];
    }
  },

  createNote: async (noteData) => {
    try {
      console.log('Создаем заметку:', noteData);
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.NOTES}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteData)
      });
      
      if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteData)
      });
      
      if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Ошибка при обновлении заметки:', error);
      throw error;
    }
  },

  deleteNote: async (id) => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.NOTES}/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Ошибка при удалении заметки:', error);
      throw error;
    }
  }
};

// ==================== ОТОБРАЖЕНИЕ ====================
function renderNotes(notes) {
  if (!elements.notesContainer) {
    console.error('Контейнер notesContainer не найден!');
    return;
  }
  
  if (notes.length === 0) {
    elements.notesContainer.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-sticky-note"></i>
        <p>Нет заметок</p>
      </div>
    `;
    return;
  }
  
  elements.notesContainer.innerHTML = notes.map(note => `
    <div class="note ${note.important ? 'important' : ''}" data-id="${note.id}">
      <div class="note-header">
        <h3>${note.title || 'Без названия'}</h3>
        <div class="note-actions">
          <button class="icon-btn edit-btn" title="Редактировать">
            <i class="fas fa-edit"></i>
          </button>
          <button class="icon-btn delete-btn" title="Удалить">
            <i class="fas fa-trash"></i>
          </button>
          <button class="icon-btn ${note.important ? 'important-btn active' : 'important-btn'}" title="${note.important ? 'Снять важность' : 'Пометить важной'}">
            <i class="fas fa-star"></i>
          </button>
        </div>
      </div>
      <div class="note-content">
        <p>${(note.content || '').replace(/\n/g, '<br>')}</p>
      </div>
      ${note.tags ? `
        <div class="note-tags">
          ${note.tags.split(',').map(tag => `<span class="tag">${tag.trim()}</span>`).join('')}
        </div>
      ` : ''}
      <div class="note-footer">
        <small>${new Date(note.created_at || Date.now()).toLocaleDateString('ru-RU')}</small>
        ${note.important ? '<span class="important-badge">Важная</span>' : ''}
      </div>
    </div>
  `).join('');
  
  // Добавляем обработчики событий для кнопок
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const noteId = e.target.closest('.note').dataset.id;
      const note = notes.find(n => n.id == noteId);
      if (note) openEditModal(note);
    });
  });
  
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const noteId = e.target.closest('.note').dataset.id;
      if (confirm('Удалить заметку?')) {
        api.deleteNote(noteId).then(() => loadNotes());
      }
    });
  });
  
  document.querySelectorAll('.important-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const noteId = e.target.closest('.note').dataset.id;
      const note = notes.find(n => n.id == noteId);
      if (note) {
        try {
          await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.NOTES}/${noteId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ important: !note.important })
          });
          loadNotes();
        } catch (error) {
          console.error('Ошибка при изменении важности:', error);
        }
      }
    });
  });
}

// ==================== МОДАЛЬНОЕ ОКНО ====================
function openNewModal() {
  appState.isEditing = false;
  appState.currentNoteId = null;
  elements.noteTitle.value = '';
  elements.noteContent.value = '';
  elements.noteTags.value = '';
  elements.noteImportant.checked = false;
  
  const modalTitle = document.querySelector('#modalTitle');
  if (modalTitle) modalTitle.textContent = 'Новая заметка';
  
  const saveBtn = elements.saveBtn;
  if (saveBtn) saveBtn.textContent = 'Создать';
  
  elements.noteModal.style.display = 'block';
}

function openEditModal(note) {
  appState.isEditing = true;
  appState.currentNoteId = note.id;
  elements.noteTitle.value = note.title || '';
  elements.noteContent.value = note.content || '';
  elements.noteTags.value = note.tags || '';
  elements.noteImportant.checked = Boolean(note.important);
  
  const modalTitle = document.querySelector('#modalTitle');
  if (modalTitle) modalTitle.textContent = 'Редактировать заметку';
  
  const saveBtn = elements.saveBtn;
  if (saveBtn) saveBtn.textContent = 'Обновить';
  
  elements.noteModal.style.display = 'block';
}

function closeModal() {
  elements.noteModal.style.display = 'none';
}

// ==================== ФИЛЬТРАЦИЯ И СОРТИРОВКА ====================
function applyFiltersAndSort() {
  let result = [...appState.notes];
  
  // Фильтрация
  if (appState.filter === 'important') {
    result = result.filter(note => note.important);
  } else if (appState.filter === 'deleted') {
    // Для корзины - если у вас есть поле deleted
    result = result.filter(note => note.deleted);
  }
  
  // Поиск
  if (appState.searchQuery) {
    const query = appState.searchQuery.toLowerCase();
    result = result.filter(note => 
      (note.title && note.title.toLowerCase().includes(query)) ||
      (note.content && note.content.toLowerCase().includes(query)) ||
      (note.tags && note.tags.toLowerCase().includes(query))
    );
  }
  
  // Сортировка
  if (appState.sortBy === 'newest') {
    result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } else if (appState.sortBy === 'oldest') {
    result.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
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

// ==================== УВЕДОМЛЕНИЯ ====================
function showNotification(message, type = 'info') {
  const area = document.getElementById('notificationArea');
  if (!area) return;
  
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
    <span>${message}</span>
    <button class="close-notification">&times;</button>
  `;
  
  area.appendChild(notification);
  
  notification.querySelector('.close-notification').addEventListener('click', () => {
    notification.remove();
  });
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 3000);
}

// ==================== ОСНОВНЫЕ ФУНКЦИИ ====================
async function loadNotes() {
  console.log('Загрузка заметок...');
  appState.notes = await api.getAllNotes();
  applyFiltersAndSort();
}

async function saveNote() {
  const noteData = {
    title: elements.noteTitle.value.trim(),
    content: elements.noteContent.value.trim(),
    tags: elements.noteTags.value.trim(),
    important: elements.noteImportant.checked
  };
  
  if (!noteData.title || !noteData.content) {
    showNotification('Заполните заголовок и текст заметки', 'error');
    return;
  }
  
  try {
    if (appState.isEditing && appState.currentNoteId) {
      await api.updateNote(appState.currentNoteId, noteData);
      showNotification('Заметка обновлена!', 'success');
    } else {
      await api.createNote(noteData);
      showNotification('Заметка создана!', 'success');
    }
    
    closeModal();
    await loadNotes();
  } catch (error) {
    console.error('Ошибка при сохранении:', error);
    showNotification('Ошибка при сохранении заметки', 'error');
  }
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
function initApp() {
  console.log('Инициализация приложения...');
  
  // Кнопка новой заметки
  if (elements.newNoteBtn) {
    elements.newNoteBtn.addEventListener('click', openNewModal);
  }
  
  // Сохранение заметки
  if (elements.saveBtn) {
    elements.saveBtn.addEventListener('click', saveNote);
  }
  
  // Закрытие модального окна
  if (elements.cancelBtn) elements.cancelBtn.addEventListener('click', closeModal);
  if (elements.closeModal) elements.closeModal.addEventListener('click', closeModal);
  
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
        // Убрать активный класс у всех
        elements.filterBtns.forEach(b => b.classList.remove('active'));
        // Добавить активный класс текущему
        btn.classList.add('active');
        
        appState.filter = btn.dataset.filter;
        applyFiltersAndSort();
      });
    });
  }
  
  // Очистка всех заметок
  if (elements.clearAllBtn) {
    elements.clearAllBtn.addEventListener('click', async () => {
      if (confirm('Удалить ВСЕ заметки? Это действие нельзя отменить!')) {
        try {
          // Удаляем каждую заметку по отдельности
          const deletePromises = appState.notes.map(note => api.deleteNote(note.id));
          await Promise.all(deletePromises);
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
  loadNotes();
  
  console.log('Приложение готово!');
}

// ==================== ЗАПУСК ====================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Для отладки
window.app = { loadNotes, api, appState };
console.log('Заметки приложение загружено! Используйте app в консоли');
