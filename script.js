// ==================== КОНФИГУРАЦИЯ ====================
const API_CONFIG = {
  BASE_URL: 'https://notes-backend-production-1d9a.up.railway.app/api',
  ENDPOINTS: {
    NOTES: '/notes',
    IMPORTANT: '/notes/important'
  }
};

// ==================== DOM ЭЛЕМЕНТЫ ====================
const elements = {
  notesList: document.getElementById('notesList'),
  noteForm: document.getElementById('noteForm'),
  noteTitle: document.getElementById('noteTitle'),
  noteContent: document.getElementById('noteContent'),
  noteTags: document.getElementById('noteTags'),
  importantCheckbox: document.getElementById('importantCheckbox'),
  filterImportant: document.getElementById('filterImportant'),
  searchInput: document.getElementById('searchInput'),
  loadingIndicator: document.getElementById('loadingIndicator'),
  errorAlert: document.getElementById('errorAlert'),
  emptyState: document.getElementById('emptyState')
};

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
  // Показать/скрыть элементы
  showElement: (element) => element && (element.style.display = 'block'),
  hideElement: (element) => element && (element.style.display = 'none'),
  
  // Форматирование даты
  formatDate: (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },
  
  // Создание DOM элемента
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
  // Получить все заметки
  getAllNotes: async () => {
    try {
      utils.showElement(elements.loadingIndicator);
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.NOTES}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Ошибка при загрузке заметок:', error);
      utils.showElement(elements.errorAlert);
      return [];
    } finally {
      utils.hideElement(elements.loadingIndicator);
    }
  },

  // Создать заметку
  createNote: async (noteData) => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.NOTES}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(noteData)
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Ошибка при создании заметки:', error);
      throw error;
    }
  },

  // Обновить заметку
  updateNote: async (id, noteData) => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.NOTES}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(noteData)
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Ошибка при обновлении заметки:', error);
      throw error;
    }
  },

  // Удалить заметку
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

  // Переключить важность заметки
  toggleImportance: async (id, important) => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.NOTES}/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
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

// ==================== ОБРАБОТКА ФОРМЫ ====================
const formHandler = {
  // Сброс формы
  resetForm: () => {
    elements.noteTitle.value = '';
    elements.noteContent.value = '';
    elements.noteTags.value = '';
    elements.importantCheckbox.checked = false;
    appState.isEditing = false;
    appState.currentNoteId = null;
    
    // Изменить текст кнопки
    const submitBtn = elements.noteForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Создать заметку';
  },

  // Заполнить форму для редактирования
  fillFormForEdit: (note) => {
    elements.noteTitle.value = note.title || '';
    elements.noteContent.value = note.content || '';
    elements.noteTags.value = note.tags ? note.tags.join(', ') : '';
    elements.importantCheckbox.checked = Boolean(note.important);
    appState.isEditing = true;
    appState.currentNoteId = note.id;
    
    // Изменить текст кнопки
    const submitBtn = elements.noteForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Обновить заметку';
  },

  // Обработчик отправки формы
  handleSubmit: async (event) => {
    event.preventDefault();
    
    const noteData = {
      title: elements.noteTitle.value.trim(),
      content: elements.noteContent.value.trim(),
      tags: elements.noteTags.value.split(',').map(tag => tag.trim()).filter(tag => tag),
      important: elements.importantCheckbox.checked
    };
    
    // Валидация
    if (!noteData.title || !noteData.content) {
      alert('Пожалуйста, заполните заголовок и содержание заметки');
      return;
    }
    
    try {
      if (appState.isEditing && appState.currentNoteId) {
        // Режим редактирования
        await api.updateNote(appState.currentNoteId, noteData);
        showNotification('Заметка обновлена успешно!', 'success');
      } else {
        // Режим создания
        await api.createNote(noteData);
        showNotification('Заметка создана успешно!', 'success');
      }
      
      // Обновить список и сбросить форму
      await loadNotes();
      formHandler.resetForm();
    } catch (error) {
      console.error('Ошибка при сохранении заметки:', error);
      showNotification('Ошибка при сохранении заметки', 'error');
    }
  }
};

// ==================== ОТОБРАЖЕНИЕ ЗАМЕТОК ====================
const renderer = {
  // Отобразить список заметок
  renderNotesList: (notes) => {
    if (!elements.notesList) return;
    
    // Очистить список
    elements.notesList.innerHTML = '';
    
    // Показать/скрыть состояние "пусто"
    if (notes.length === 0) {
      utils.showElement(elements.emptyState);
      return;
    }
    utils.hideElement(elements.emptyState);
    
    // Создать элементы заметок
    notes.forEach(note => {
      const noteElement = renderer.createNoteElement(note);
      elements.notesList.appendChild(noteElement);
    });
  },

  // Создать элемент заметки
  createNoteElement: (note) => {
    const noteCard = utils.createElement('div', 'note-card');
    if (note.important) noteCard.classList.add('important');
    
    // Заголовок
    const title = utils.createElement('h3', 'note-title', note.title);
    
    // Содержание
    const content = utils.createElement('p', 'note-content', note.content);
    
    // Теги
    let tagsElement = null;
    if (note.tags && note.tags.length > 0) {
      const tagsText = note.tags.map(tag => `#${tag}`).join(' ');
      tagsElement = utils.createElement('div', 'note-tags', tagsText);
    }
    
    // Даты
    const dateInfo = utils.createElement('div', 'note-date');
    if (note.created_at) {
      dateInfo.textContent = `Создано: ${utils.formatDate(note.created_at)}`;
    }
    
    // Кнопки действий
    const actions = utils.createElement('div', 'note-actions');
    
    // Кнопка редактирования
    const editBtn = utils.createElement('button', 'btn btn-edit', '✏️ Редактировать');
    editBtn.addEventListener('click', () => formHandler.fillFormForEdit(note));
    
    // Кнопка удаления
    const deleteBtn = utils.createElement('button', 'btn btn-delete', '🗑️ Удалить');
    deleteBtn.addEventListener('click', () => renderer.handleDeleteNote(note.id));
    
    // Кнопка важности
    const importanceText = note.important ? '★ Сделать обычной' : '☆ Отметить важной';
    const importanceBtn = utils.createElement('button', 'btn btn-importance', importanceText);
    importanceBtn.addEventListener('click', () => renderer.handleToggleImportance(note.id, !note.important));
    
    actions.appendChild(editBtn);
    actions.appendChild(importanceBtn);
    actions.appendChild(deleteBtn);
    
    // Собрать карточку
    noteCard.appendChild(title);
    noteCard.appendChild(content);
    if (tagsElement) noteCard.appendChild(tagsElement);
    noteCard.appendChild(dateInfo);
    noteCard.appendChild(actions);
    
    return noteCard;
  },

  // Обработчик удаления заметки
  handleDeleteNote: async (id) => {
    if (!confirm('Вы уверены, что хотите удалить эту заметку?')) return;
    
    try {
      await api.deleteNote(id);
      showNotification('Заметка удалена успешно!', 'success');
      await loadNotes();
    } catch (error) {
      console.error('Ошибка при удалении заметки:', error);
      showNotification('Ошибка при удалении заметки', 'error');
    }
  },

  // Обработчик переключения важности
  handleToggleImportance: async (id, important) => {
    try {
      await api.toggleImportance(id, important);
      const message = important ? 'Заметка отмечена как важная' : 'Заметка стала обычной';
      showNotification(message, 'success');
      await loadNotes();
    } catch (error) {
      console.error('Ошибка при изменении важности:', error);
      showNotification('Ошибка при изменении важности', 'error');
    }
  }
};

// ==================== ФИЛЬТРАЦИЯ И ПОИСК ====================
const filterHandler = {
  // Применить фильтры
  applyFilters: () => {
    let result = [...appState.notes];
    
    // Фильтр по важности
    if (appState.showImportantOnly) {
      result = result.filter(note => note.important);
    }
    
    // Поиск по тексту
    if (appState.searchQuery.trim()) {
      const query = appState.searchQuery.toLowerCase();
      result = result.filter(note => 
        (note.title && note.title.toLowerCase().includes(query)) ||
        (note.content && note.content.toLowerCase().includes(query)) ||
        (note.tags && note.tags.some(tag => tag.toLowerCase().includes(query)))
      );
    }
    
    appState.filteredNotes = result;
    renderer.renderNotesList(result);
  },

  // Инициализация обработчиков фильтров
  initFilters: () => {
    if (elements.filterImportant) {
      elements.filterImportant.addEventListener('change', (e) => {
        appState.showImportantOnly = e.target.checked;
        filterHandler.applyFilters();
      });
    }
    
    if (elements.searchInput) {
      elements.searchInput.addEventListener('input', (e) => {
        appState.searchQuery = e.target.value;
        filterHandler.applyFilters();
      });
    }
  }
};

// ==================== УВЕДОМЛЕНИЯ ====================
function showNotification(message, type = 'info') {
  // Создаем или находим контейнер для уведомлений
  let container = document.getElementById('notificationContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notificationContainer';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000;
    `;
    document.body.appendChild(container);
  }
  
  // Создаем уведомление
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    padding: 12px 20px;
    margin-bottom: 10px;
    border-radius: 4px;
    color: white;
    font-weight: 500;
    animation: slideIn 0.3s ease;
  `;
  
  // Цвет в зависимости от типа
  if (type === 'success') {
    notification.style.backgroundColor = '#4CAF50';
  } else if (type === 'error') {
    notification.style.backgroundColor = '#f44336';
  } else {
    notification.style.backgroundColor = '#2196F3';
  }
  
  container.appendChild(notification);
  
  // Автоматическое удаление через 3 секунды
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
  
  // Добавляем CSS анимации
  if (!document.querySelector('#notificationStyles')) {
    const style = document.createElement('style');
    style.id = 'notificationStyles';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
}

// ==================== ОСНОВНЫЕ ФУНКЦИИ ====================
// Загрузить заметки
async function loadNotes() {
  appState.notes = await api.getAllNotes();
  appState.filteredNotes = [...appState.notes];
  filterHandler.applyFilters();
}

// Инициализация приложения
async function initApp() {
  try {
    // Скрыть уведомление об ошибке
    utils.hideElement(elements.errorAlert);
    
    // Загрузить заметки
    await loadNotes();
    
    // Настроить обработчики событий
    if (elements.noteForm) {
      elements.noteForm.addEventListener('submit', formHandler.handleSubmit);
    }
    
    // Кнопка отмены редактирования
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', formHandler.resetForm);
    }
    
    // Инициализировать фильтры
    filterHandler.initFilters();
    
    console.log('Приложение инициализировано успешно!');
  } catch (error) {
    console.error('Ошибка инициализации приложения:', error);
    utils.showElement(elements.errorAlert);
  }
}

// ==================== ЗАПУСК ПРИЛОЖЕНИЯ ====================
// Ждем загрузки DOM
document.addEventListener('DOMContentLoaded', initApp);

// Экспорт для отладки в консоли
window.app = {
  state: appState,
  api,
  utils,
  reload: loadNotes
};
