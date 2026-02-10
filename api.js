// api.js - Работа с API бэкенда (фронтендная часть)
const API_CONFIG = {
    BASE_URL: 'https://notes-backend-production-1d9a.up.railway.app/api',
    ENDPOINTS: {
        NOTES: '/notes'
    }
};

class NotesAPI {
    constructor() {
        this.baseUrl = API_CONFIG.BASE_URL;
    }

    // Получить все заметки
    async getNotes() {
        try {
            const response = await fetch(`${this.baseUrl}/notes`);
            return await response.json();
        } catch (error) {
            console.error('Ошибка загрузки заметок:', error);
            return [];
        }
    }

    // Создать заметку
    async createNote(noteData) {
        try {
            const response = await fetch(`${this.baseUrl}/notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(noteData)
            });
            return await response.json();
        } catch (error) {
            console.error('Ошибка создания заметки:', error);
            return { error: error.message };
        }
    }

    // Обновить заметку
    async updateNote(id, noteData) {
        try {
            const response = await fetch(`${this.baseUrl}/notes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(noteData)
            });
            return await response.json();
        } catch (error) {
            console.error('Ошибка обновления заметки:', error);
            return { error: error.message };
        }
    }

    // Удалить заметку
    async deleteNote(id) {
        try {
            const response = await fetch(`${this.baseUrl}/notes/${id}`, {
                method: 'DELETE'
            });
            return await response.json();
        } catch (error) {
            console.error('Ошибка удаления заметки:', error);
            return { error: error.message };
        }
    }
}

// Создаем глобальный экземпляр для использования
window.notesAPI = new NotesAPI();
