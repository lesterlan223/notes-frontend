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

// ==================== DOM ЭЛЕМЕНТЫ ====================
// Более безопасное получение элементов с резервными вариантами
const getElement = (id, fallbackId = null) => {
  const element = document.getElementById(id);
  if (!element && fallbackId) {
    return document.getElementById(fallbackId);
  }
  return element;
};

const elements = {
  notesList: getElement('notesList', 'noteList'), // Пробуем notesList или noteList
  noteForm: getElement('noteForm'),
  noteTitle: getElement('noteTitle'),
  noteContent: getElement('noteContent', 'noteText'), // Пробуем noteContent или noteText
  noteTags: getElement('noteTags'),
  importantCheckbox: getElement('importantCheckbox'),
  filterImportant: getElement('filterImportant'),
  searchInput: getElement('searchInput'),
  loadingIndicator: getElement('loadingIndicator'),
  errorAlert: getElement('errorAlert'),
  emptyState: getElement('emptyState')
};

// Проверяем какие элементы найдены
console.log('Найденные элементы:', Object.keys(elements)
  .filter(key => elements[key])
  .map(key => `${key}: ✓`));

// ==================== СОСТОЯНИЕ ПРИЛОЖЕНИЯ ====================
let appState = {
  notes: [],
  filteredNotes: [],
  isEditing: false,
  currentNoteId: null,
  showImportantOnly: false,
  searchQuery: ''
};

// ==================== УТИЛИТЫ ====================
const utils = {
  showElement: (element) => element && (element.style.display = 'block'),
  hideElement: (element) => element && (element.style.display = 'none'),
  
  formatDate: (dateString) => {
    if (!dateString) return 'Дата не указана';
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
  },
  
  createElement: (tag, className, text = '', attributes = {}) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    return element;
  }
};

// ==================== API ФУНКЦИИ ====================
const api = {
  getAllNotes: async () => {
    try {
      if (elements.loadingIndicator) utils.showElement(elements.loadingIndicator);
      console.log('Загружаем заметки с:', `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.NOTES}`);
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.NOTES}`);
      console.log('Ответ сервера:', response.status);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      console.log('Получены заметки:', data.length || data);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Ошибка при загрузке заметок:', error);
      if (elements.errorAlert) utils.showElement(elements.errorAlert);
      return [];
    } finally {
      if (elements.loadingIndicator) utils.hideElement(elements.loadingIndicator);
    }
  },

  createNote: async (noteData) => {
    try {
      console.log('Отправляем заметку:', noteData);
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.NOTES}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noteData)
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ important })
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Ошибка при обновлении важности:', error);
      throw error;
    }
  }
};

// ==================== ОТОБРАЖЕНИЕ ЗАМЕТОК ====================
const renderer = {
  renderNotesList: (notes) => {
    // Если нет контейнера для списка, создадим его
    if (!elements.notesList) {
      console.warn('Элемент notesList не найден, создаем временный');
      const tempContainer = document.createElement('div');
      tempContainer.id = 'notesList';
      document.body.appendChild(tempContainer);
      elements.notesList = tempContainer;
    }
    
    elements.notesList.innerHTML = '';
    
    if (notes.length === 0) {
      if (elements.emptyState) {
        utils.showElement(elements.emptyState);
      } else {
        elements.notesList.innerHTML = '<p class="empty-state">Нет заметок</p>';
      }
      return;
    }
    
    if (elements.emptyState) utils.hideElement(elements.emptyState);
    
    notes.forEach(note => {
      const noteElement = renderer.createNoteElement(note);
      elements.notesList.appendChild(noteElement);
    });
  },

  createNoteElement: (note) => {
    const noteCard = utils.createElement('div', 'note-card');
    if (note.important) noteCard.classList.add('important');
    
    const title = utils.createElement('h3', 'note-title', note.title);
    const content = utils.createElement('p', 'note-content', note.content);
    
    noteCard.appendChild(title);
    noteCard.appendChild(content);
    
    // Кнопки действий
    const actions = utils.createElement('div', 'note-actions');
    
    const editBtn = utils.createElement('button', 'btn btn-edit', '✏️ Редактировать');
    editBtn.addEventListener('click', () => {
      if (elements.noteTitle && elements.noteContent) {
        elements.noteTitle.value = note.title || '';
        elements.noteContent.value = note.content || '';
        appState.isEditing = true;
        appState.currentNoteId = note.id;
        const submitBtn = elements.noteForm?.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Обновить заметку';
      }
    });
    
    const deleteBtn = utils.createElement('button', 'btn btn-delete', '🗑️ Удалить');
    deleteBtn.addEventListener('click', () => {
      if (confirm('Удалить заметку?')) api.deleteNote(note.id).then(() => loadNotes());
    });
    
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    noteCard.appendChild(actions);
    
    return noteCard;
  }
};

// ==================== ФУНКЦИИ ====================
async function loadNotes() {
  console.log('loadNotes вызвана');
  appState.notes = await api.getAllNotes();
  appState.filteredNotes = [...appState.notes];
  renderer.renderNotesList(appState.filteredNotes);
}

function showNotification(message, type = 'info') {
  console.log(`Уведомление [${type}]:`, message);
  alert(`${type === 'error' ? '❌' : '✅'} ${message}`);
}

async function initApp() {
  console.log('Инициализация приложения...');
  
  // Настройка формы
  if (elements.noteForm) {
    elements.noteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (!elements.noteTitle || !elements.noteContent) {
        console.error('Нет полей формы');
        return;
      }
      
      const noteData = {
        title: elements.noteTitle.value.trim(),
        content: elements.noteContent.value.trim(),
        important: elements.importantCheckbox?.checked || false
      };
      
      if (!noteData.title || !noteData.content) {
        alert('Заполните заголовок и содержание');
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
        
        await loadNotes();
        
        // Сброс формы
        elements.noteTitle.value = '';
        elements.noteContent.value = '';
        if (elements.importantCheckbox) elements.importantCheckbox.checked = false;
        appState.isEditing = false;
        appState.currentNoteId = null;
        
        const submitBtn = elements.noteForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Создать заметку';
        
      } catch (error) {
        showNotification('Ошибка: ' + error.message, 'error');
      }
    });
  } else {
    console.warn('Форма noteForm не найдена!');
  }
  
  // Настройка поиска
  if (elements.searchInput) {
    elements.searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      appState.filteredNotes = appState.notes.filter(note => 
        (note.title && note.title.toLowerCase().includes(query)) ||
        (note.content && note.content.toLowerCase().includes(query))
      );
      renderer.renderNotesList(appState.filteredNotes);
    });
  }
  
  // Загрузка заметок
  await loadNotes();
  console.log('Приложение инициализировано!');
}

// ==================== ЗАПУСК ====================
// Ждем полной загрузки DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Для отладки в консоли
window.notesApp = { loadNotes, api, appState };
console.log('Notes app script loaded! Используйте notesApp в консоли');
