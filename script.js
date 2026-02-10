// Конфигурация API
const API_CONFIG = {
    BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:5000/api'
        : 'https://your-railway-app.railway.app/api',
    ENDPOINTS: {
        NOTES: '/notes',
        EXPORT: '/notes/export/all',
        IMPORT: '/notes/import',
        CLEAR_TRASH: '/notes/trash/clear'
    }
};

class NotesAPI {
    constructor() {
        this.baseUrl = API_CONFIG.BASE_URL;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
            ...options
        };

        try {
            const response = await fetch(url, defaultOptions);
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Ошибка сервера');
            }

            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    async getNotes(filter = 'all', search = '', sort = 'newest') {
        const params = new URLSearchParams();
        if (filter) params.append('filter', filter);
        if (search) params.append('search', search);
        if (sort) params.append('sort', sort);

        const endpoint = `${API_CONFIG.ENDPOINTS.NOTES}?${params.toString()}`;
        return this.request(endpoint);
    }

    async getNote(id) {
        return this.request(`${API_CONFIG.ENDPOINTS.NOTES}/${id}`);
    }

    async createNote(noteData) {
        return this.request(API_CONFIG.ENDPOINTS.NOTES, {
            method: 'POST',
            body: JSON.stringify(noteData)
        });
    }

    async updateNote(id, noteData) {
        return this.request(`${API_CONFIG.ENDPOINTS.NOTES}/${id}`, {
            method: 'PUT',
            body: JSON.stringify(noteData)
        });
    }

    async deleteNote(id) {
        return this.request(`${API_CONFIG.ENDPOINTS.NOTES}/${id}/trash`, {
            method: 'DELETE'
        });
    }

    async deleteNotePermanently(id) {
        return this.request(`${API_CONFIG.ENDPOINTS.NOTES}/${id}`, {
            method: 'DELETE'
        });
    }

    async restoreNote(id) {
        return this.request(`${API_CONFIG.ENDPOINTS.NOTES}/${id}/restore`, {
            method: 'PATCH'
        });
    }

    async toggleImportant(id) {
        return this.request(`${API_CONFIG.ENDPOINTS.NOTES}/${id}/toggle-important`, {
            method: 'PATCH'
        });
    }

    async exportNotes() {
        return this.request(API_CONFIG.ENDPOINTS.EXPORT);
    }

    async importNotes(notes) {
        return this.request(API_CONFIG.ENDPOINTS.IMPORT, {
            method: 'POST',
            body: JSON.stringify({ notes })
        });
    }

    async clearDeletedNotes() {
        return this.request(API_CONFIG.ENDPOINTS.CLEAR_TRASH, {
            method: 'DELETE'
        });
    }
}

// Создаем экземпляр API
const api = new NotesAPI();


document.addEventListener('DOMContentLoaded', () => {
    const saveBtn = document.getElementById('saveBtn');
    const notesContainer = document.getElementById('notesContainer');
    const newNoteBtn = document.getElementById('newNoteBtn');
    const noteModal = document.getElementById('noteModal');
    const closeModal = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const noteForm = document.getElementById('noteForm');
    const noteTitle = document.getElementById('noteTitle');
    const noteText = document.getElementById('noteText');
    const noteTags = document.getElementById('noteTags');
    const noteImportant = document.getElementById('noteImportant');
    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortSelect');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const confirmModal = document.getElementById('confirmModal');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const clearAllModal = document.getElementById('clearAllModal');
    const confirmClearAllBtn = document.getElementById('confirmClearAllBtn');
    const cancelClearAllBtn = document.getElementById('cancelClearAllBtn');
    const themeToggle = document.getElementById('themeToggle');

    let notes = [];
    let currentNoteId = null;
    let currentFilter = 'all';
    let currentSort = '';
    let currentSearch = '';
    let selectedNoteId = null;

    loadNotes();
    renderNotes();
    setupEventListeners();

    async function loadNotes() {
        try {
            showNotification('Загрузка заметок...', 'info');
            const response = await api.getNotes(currentFilter, currentSearch, currentSort);
            notes = response.data || [];
            renderNotes();
        } catch (error) {
            showNotification('Ошибка при загрузке заметок', 'error');
            console.error('Load notes error:', error);
            // Fallback to localStorage if API fails
            const savedNotes = localStorage.getItem('notes');
            if (savedNotes) {
                notes = JSON.parse(savedNotes);
                renderNotes();
                showNotification('Используется локальное хранилище', 'warning');
            }
        }
    }

    async function saveNote(e) {
        e.preventDefault();
        
        const title = noteTitle.value.trim();
        const content = noteText.value.trim();
        const tags = noteTags.value.split(',').map(tag => tag.trim()).filter(tag => tag);
        
        if (!title || !content) {
            showNotification('Заголовок и текст заметки обязательны', 'error');
            return;
        }
        
        try {
            if (currentNoteId) {
                // Обновляем существующую заметку
                const response = await api.updateNote(currentNoteId, {
                    title,
                    content,
                    tags,
                    important: noteImportant.checked
                });
                showNotification('Заметка обновлена', 'success');
            } else {
                // Создаем новую заметку
                const response = await api.createNote({
                    title,
                    content,
                    tags,
                    important: noteImportant.checked
                });
                showNotification('Заметка создана', 'success');
            }
            
            await loadNotes(); // Перезагружаем список
            noteModal.classList.remove('active');
        } catch (error) {
            showNotification('Ошибка при сохранении заметки', 'error');
            console.error('Save note error:', error);
        }
    }

    function renderNotes() {
        notesContainer.innerHTML = '';
        
        let filteredNotes = filterNotes(notes);
        filteredNotes = sortNotes(filteredNotes);
        
        if (filteredNotes.length === 0) {
            const emptyMessage = currentFilter === 'deleted' 
                ? 'Корзина пуста'
                : currentSearch 
                ? 'По вашему запросу ничего не найдено'
                : 'Нет заметок';
            
            notesContainer.innerHTML = `
                <div class="empty">
                    <i class="fas fa-${currentFilter === 'deleted' ? 'trash' : 'sticky-note'}"></i>
                    <h3>${emptyMessage}</h3>
                    <p>${currentFilter === 'deleted' ? 'Удаленные заметки появятся здесь' : 'Создайте первую заметку!'}</p>
                </div>
            `;
            return;
        }
        
        filteredNotes.forEach(note => {
            const noteElement = createNoteElement(note);
            notesContainer.appendChild(noteElement);
        });
    }

    function filterNotes(notesList) {
        if (currentFilter === 'deleted') {
            return notesList.filter(note => note.deleted);
        }
        
        let filtered = notesList.filter(note => !note.deleted);
        
        if (currentFilter === 'important') {
            filtered = filtered.filter(note => note.important);
        }
        
        if (currentSearch) {
            const searchLower = currentSearch.toLowerCase();
            filtered = filtered.filter(note => 
                note.title.toLowerCase().includes(searchLower) || 
                note.content.toLowerCase().includes(searchLower) ||
                (note.tags && note.tags.some(tag => tag.toLowerCase().includes(searchLower)))
            );
        }
        
        return filtered;
    }

    function sortNotes(notesList) {
        if (!currentSort) return notesList;
        
        return [...notesList].sort((a, b) => {
            switch(currentSort) {
                case 'newest':
                    return new Date(b.updatedAt) - new Date(a.updatedAt);
                case 'oldest':
                    return new Date(a.updatedAt) - new Date(b.updatedAt);
                case 'alpha-asc':
                    return a.title.localeCompare(b.title);
                case 'alpha-desc':
                    return b.title.localeCompare(a.title);
                case 'important':
                    return (b.important === a.important) ? 0 : b.important ? 1 : -1;
                default:
                    return 0;
            }
        });
    }

    function createNoteElement(note) {
        const noteDiv = document.createElement('div');
        noteDiv.className = `note ${note.important ? 'important' : ''} ${note.deleted ? 'deleted' : ''} ${selectedNoteId === note.id ? 'active' : ''}`;
        noteDiv.dataset.id = note.id;
        
        const date = new Date(note.updatedAt);
        const formattedDate = date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        noteDiv.innerHTML = `
            <div class="note-header">
                <div class="note-title">
                    ${note.important ? '<i class="fas fa-star note-important"></i>' : ''}
                    ${escapeHtml(note.title)}
                </div>
            </div>
            <div class="note-content">${escapeHtml(note.content).replace(/\n/g, '<br>')}</div>
            ${note.tags && note.tags.length > 0 ? `
                <div class="note-tags">
                    ${note.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
                </div>
            ` : ''}
            <div class="note-date">
                <i class="far fa-clock"></i> ${formattedDate}
            </div>
            <div class="note-actions">
                ${!note.deleted ? `
                    <button class="note-btn edit" title="Редактировать">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="note-btn important-btn" title="${note.important ? 'Снять важность' : 'Пометить важной'}">
                        <i class="${note.important ? 'fas fa-star' : 'far fa-star'}"></i>
                    </button>
                    <button class="note-btn delete" title="Удалить">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : `
                    <button class="note-btn restore" title="Восстановить">
                        <i class="fas fa-undo"></i>
                    </button>
                    <button class="note-btn delete" title="Удалить навсегда">
                        <i class="fas fa-trash"></i>
                    </button>
                `}
            </div>
        `;
        
        noteDiv.addEventListener('click', (e) => {
            if (!e.target.closest('.note-actions')) {
                if (selectedNoteId === note.id) {
                    selectedNoteId = null;
                    noteDiv.classList.remove('active');
                } else {
                    selectedNoteId = note.id;
                    document.querySelectorAll('.note').forEach(n => n.classList.remove('active'));
                    noteDiv.classList.add('active');
                }
            }
        });
        
        const editBtn = noteDiv.querySelector('.edit');
        const importantBtn = noteDiv.querySelector('.important-btn');
        const deleteBtn = noteDiv.querySelector('.delete');
        const restoreBtn = noteDiv.querySelector('.restore');
        
        if (editBtn) editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            editNote(note.id);
        });
        if (importantBtn) importantBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleImportant(note.id, importantBtn);
        });
        if (deleteBtn) deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (note.deleted) {
                showConfirmModal('Вы уверены, что хотите удалить эту заметку навсегда?', () => {
                    deleteNotePermanently(note.id);
                });
            } else {
                showConfirmModal('Вы уверены, что хотите удалить эту заметку?', () => {
                    deleteNote(note.id);
                });
            }
        });
        if (restoreBtn) restoreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            restoreNote(note.id);
        });
        
        return noteDiv;
    }

    function openNewNoteModal() {
        currentNoteId = null;
        document.getElementById('modalTitle').textContent = 'Новая заметка';
        noteForm.reset();
        noteModal.classList.add('active');
        noteTitle.focus();
    }

    function editNote(id) {
        const note = notes.find(n => n.id === id);
        if (!note) return;
        
        currentNoteId = id;
        document.getElementById('modalTitle').textContent = 'Редактировать заметку';
        noteTitle.value = note.title;
        noteText.value = note.content;
        noteTags.value = note.tags ? note.tags.join(', ') : '';
        noteImportant.checked = note.important;
        noteModal.classList.add('active');
        noteTitle.focus();
    }

    function saveNote(e) {
        e.preventDefault();
        
        const title = noteTitle.value.trim();
        const content = noteText.value.trim();
        const tags = noteTags.value.split(',').map(tag => tag.trim()).filter(tag => tag);
        
        if (!title || !content) {
            showNotification('Заголовок и текст заметки обязательны', 'error');
            return;
        }
        
        const now = new Date().toISOString();
        
        if (currentNoteId) {
            const noteIndex = notes.findIndex(n => n.id === currentNoteId);
            if (noteIndex !== -1) {
                notes[noteIndex] = {
                    ...notes[noteIndex],
                    title,
                    content,
                    tags,
                    important: noteImportant.checked,
                    updatedAt: now
                };
                showNotification('Заметка обновлена', 'success');
            }
        } else {
            const newId = notes.length > 0 ? Math.max(...notes.map(n => n.id)) + 1 : 1;
            notes.push({
                id: newId,
                title,
                content,
                tags,
                important: noteImportant.checked,
                deleted: false,
                createdAt: now,
                updatedAt: now
            });
            showNotification('Заметка создана', 'success');
        }
        
        saveNotes();
        renderNotes();
        noteModal.classList.remove('active');
    }

    function deleteNote(id) {
        const noteIndex = notes.findIndex(n => n.id === id);
        if (noteIndex !== -1) {
            notes[noteIndex].deleted = true;
            notes[noteIndex].updatedAt = new Date().toISOString();
            saveNotes();
            renderNotes();
            showNotification('Заметка перемещена в корзину', 'info');
        }
    }

    function deleteNotePermanently(id) {
        notes = notes.filter(n => n.id !== id);
        saveNotes();
        renderNotes();
        showNotification('Заметка удалена навсегда', 'success');
    }

    function restoreNote(id) {
        const noteIndex = notes.findIndex(n => n.id === id);
        if (noteIndex !== -1) {
            notes[noteIndex].deleted = false;
            notes[noteIndex].updatedAt = new Date().toISOString();
            saveNotes();
            renderNotes();
            showNotification('Заметка восстановлена', 'success');
        }
    }

    function toggleImportant(id, buttonElement = null) {
        const noteIndex = notes.findIndex(n => n.id === id);
        if (noteIndex !== -1) {
            notes[noteIndex].important = !notes[noteIndex].important;
            notes[noteIndex].updatedAt = new Date().toISOString();
            saveNotes();
            
            if (buttonElement) {
                const icon = buttonElement.querySelector('i');
                const title = buttonElement.getAttribute('title');
                
                if (notes[noteIndex].important) {
                    icon.className = 'fas fa-star';
                    buttonElement.setAttribute('title', 'Снять важность');
                    
                    const noteElement = document.querySelector(`.note[data-id="${id}"]`);
                    if (noteElement) {
                        const titleElement = noteElement.querySelector('.note-title');
                        if (!titleElement.querySelector('.note-important')) {
                            const starIcon = document.createElement('i');
                            starIcon.className = 'fas fa-star note-important';
                            titleElement.insertBefore(starIcon, titleElement.firstChild);
                        }
                        noteElement.classList.add('important');
                    }
                } else {
                    icon.className = 'far fa-star';
                    buttonElement.setAttribute('title', 'Пометить важной');
                    
                    const noteElement = document.querySelector(`.note[data-id="${id}"]`);
                    if (noteElement) {
                        const starIcon = noteElement.querySelector('.note-title .note-important');
                        if (starIcon) {
                            starIcon.remove();
                        }
                        noteElement.classList.remove('important');
                    }
                }
            } else {
                renderNotes();
            }
            
            showNotification(
                notes[noteIndex].important 
                    ? 'Заметка помечена как важная' 
                    : 'Снята отметка важности', 
                'info'
            );
        }
    }

    function clearAllNotes() {
        notes = [];
        saveNotes();
        renderNotes();
        showNotification('Все заметки удалены', 'success');
    }

    async function exportNotes() {
        try {
            const response = await api.exportNotes();
            const dataStr = JSON.stringify(response.data, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            
            const exportFileDefaultName = `notes_${new Date().toISOString().split('T')[0]}.json`;
            
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
            
            showNotification('Заметки экспортированы', 'success');
        } catch (error) {
            showNotification('Ошибка при экспорте заметок', 'error');
            console.error('Export error:', error);
        }
    }

        async function importNotes() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const importedNotes = JSON.parse(event.target.result);
                    if (!Array.isArray(importedNotes)) {
                        throw new Error('Неверный формат файла');
                    }
                    
                    await api.importNotes(importedNotes);
                    showNotification('Заметки успешно импортированы', 'success');
                    await loadNotes();
                    
                } catch (error) {
                    showNotification('Ошибка при импорте файла', 'error');
                    console.error('Import error:', error);
                }
            };
            reader.readAsText(file);
        };
        
        input.click();
    }
    
    function showConfirmModal(message, confirmCallback) {
        document.getElementById('confirmMessage').textContent = message;
        confirmModal.classList.add('active');
        
        const handleConfirm = () => {
            confirmCallback();
            confirmModal.classList.remove('active');
            cleanupListeners();
        };
        
        const handleCancel = () => {
            confirmModal.classList.remove('active');
            cleanupListeners();
        };
        
        function cleanupListeners() {
            confirmDeleteBtn.removeEventListener('click', handleConfirm);
            cancelDeleteBtn.removeEventListener('click', handleCancel);
        }
        
        confirmDeleteBtn.addEventListener('click', handleConfirm);
        cancelDeleteBtn.addEventListener('click', handleCancel);
    }

    function showNotification(message, type = 'info') {
        const notificationArea = document.getElementById('notificationArea');
        const notificationId = 'notification-' + Date.now();
        
        const notification = document.createElement('div');
        notification.id = notificationId;
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
            <button class="close-notification">&times;</button>
        `;
        
        notificationArea.appendChild(notification);
        
        setTimeout(() => {
            const notif = document.getElementById(notificationId);
            if (notif) {
                notif.style.opacity = '0';
                notif.style.transform = 'translateX(100%)';
                setTimeout(() => notif.remove(), 300);
            }
        }, 5000);
        
        notification.querySelector('.close-notification').addEventListener('click', () => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function setupEventListeners() {
        newNoteBtn.addEventListener('click', openNewNoteModal);
        
        closeModal.addEventListener('click', () => noteModal.classList.remove('active'));
        cancelBtn.addEventListener('click', () => noteModal.classList.remove('active'));
        
        noteForm.addEventListener('submit', saveNote);
        
        searchInput.addEventListener('input', (e) => {
            currentSearch = e.target.value;
            renderNotes();
        });

        noteForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveNote(e);
        });

        saveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            saveNote(e);
        });
        
        sortSelect.addEventListener('change', (e) => {
            currentSort = e.target.value;
            renderNotes();
        });
        
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.dataset.filter;
                renderNotes();
            });
        });
        
        exportBtn.addEventListener('click', exportNotes);
        
        importBtn.addEventListener('click', importNotes);
        
        clearAllBtn.addEventListener('click', () => {
            clearAllModal.classList.add('active');
        });
        
        confirmClearAllBtn.addEventListener('click', () => {
            clearAllNotes();
            clearAllModal.classList.remove('active');
        });
        
        cancelClearAllBtn.addEventListener('click', () => {
            clearAllModal.classList.remove('active');
        });
        
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault();
                openNewNoteModal(); 
            }
            
            if ((e.ctrlKey || e.metaKey) && e.key === 'q') {
                if (noteModal.classList.contains('active')) {
                    e.preventDefault();
                    saveBtn.click();
                }
            }
            
            if (e.key === 'Escape') {
                if (noteModal.classList.contains('active')) {
                    noteModal.classList.remove('active');
                }
                if (confirmModal.classList.contains('active')) {
                    confirmModal.classList.remove('active');
                }
                if (clearAllModal.classList.contains('active')) {
                    clearAllModal.classList.remove('active');
                }
            }
        });
        
        window.addEventListener('click', (e) => {
            if (e.target === noteModal) {
                noteModal.classList.remove('active');
            }
            if (e.target === confirmModal) {
                confirmModal.classList.remove('active');
            }
            if (e.target === clearAllModal) {
                clearAllModal.classList.remove('active');
            }
        });
        
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            
            themeToggle.innerHTML = newTheme === 'dark' 
                ? '<i class="fas fa-sun"></i> Тема' 
                : '<i class="fas fa-moon"></i> Тема';
        });
        
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        themeToggle.innerHTML = savedTheme === 'dark' 
            ? '<i class="fas fa-sun"></i> Тема' 
            : '<i class="fas fa-moon"></i> Тема';
    }
});
