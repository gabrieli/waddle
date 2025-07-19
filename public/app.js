/**
 * Waddle UI - Modern DevOps Dashboard
 * Inspired by V0/Loveable with real-time updates
 */

class WaddleApp {
    constructor() {
        this.baseUrl = 'http://localhost:3000';
        this.data = {
            workItems: [],
            tasks: [],
            agents: [],
            schedulerStatus: null
        };
        this.refreshInterval = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadInitialData();
        this.startAutoRefresh();
        this.updateSystemStatus('running', 'System Online');
    }

    setupEventListeners() {
        // Header buttons
        document.getElementById('createWorkItemBtn').addEventListener('click', () => {
            this.showCreateWorkItemModal();
        });

        document.getElementById('schedulerToggle').addEventListener('click', () => {
            this.toggleScheduler();
        });

        document.getElementById('viewLogsBtn').addEventListener('click', () => {
            this.showActivityLogsModal();
        });

        // Modal events
        document.getElementById('closeCreateModal').addEventListener('click', () => {
            this.hideModal('createWorkItemModal');
        });

        document.getElementById('cancelCreateBtn').addEventListener('click', () => {
            this.hideModal('createWorkItemModal');
        });

        document.getElementById('closeLogsModal').addEventListener('click', () => {
            this.hideModal('activityLogsModal');
        });

        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('modalOverlay')) {
                this.hideAllModals();
            }
        });

        // Form submission
        document.getElementById('createWorkItemForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createWorkItem();
        });

        // Filter
        document.getElementById('workItemFilter').addEventListener('change', (e) => {
            this.filterWorkItems(e.target.value);
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideAllModals();
            }
            if (e.key === 'n' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.showCreateWorkItemModal();
            }
        });
    }

    async loadInitialData() {
        try {
            await Promise.all([
                this.loadWorkItems(),
                this.loadTasks(),
                this.loadAgents(),
                this.loadSchedulerStatus()
            ]);
            this.renderAll();
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.showToast('Failed to load data', 'error');
        }
    }

    async loadWorkItems() {
        try {
            const response = await fetch(`${this.baseUrl}/api/work-items`);
            if (!response.ok) throw new Error('Failed to fetch work items');
            const result = await response.json();
            this.data.workItems = result.workItems || [];
        } catch (error) {
            console.error('Error loading work items:', error);
            this.data.workItems = [];
        }
    }

    async loadTasks() {
        try {
            const response = await fetch(`${this.baseUrl}/api/tasks`);
            if (!response.ok) throw new Error('Failed to fetch tasks');
            const result = await response.json();
            this.data.tasks = result.tasks || [];
        } catch (error) {
            console.error('Error loading tasks:', error);
            this.data.tasks = [];
        }
    }

    async loadAgents() {
        try {
            const response = await fetch(`${this.baseUrl}/api/agents`);
            if (!response.ok) throw new Error('Failed to fetch agents');
            const result = await response.json();
            this.data.agents = result.agents || [];
        } catch (error) {
            console.error('Error loading agents:', error);
            this.data.agents = [];
        }
    }

    async loadSchedulerStatus() {
        try {
            const response = await fetch(`${this.baseUrl}/api/scheduler/status`);
            if (!response.ok) throw new Error('Failed to fetch scheduler status');
            const result = await response.json();
            this.data.schedulerStatus = result.status;
        } catch (error) {
            console.error('Error loading scheduler status:', error);
            this.data.schedulerStatus = { isRunning: false, intervalSeconds: 30, lastRunAt: null };
        }
    }

    renderAll() {
        this.renderWorkItems();
        this.renderTasks();
        this.renderAgents();
        this.renderSchedulerStatus();
        this.renderMetrics();
        this.renderActivityStream();
    }

    renderWorkItems() {
        const columns = {
            new: document.getElementById('newColumn'),
            in_progress: document.getElementById('progressColumn'),
            review: document.getElementById('reviewColumn'),
            done: document.getElementById('doneColumn')
        };

        // Clear columns
        Object.values(columns).forEach(column => {
            column.innerHTML = '';
        });

        // Group work items by status
        const groupedItems = {};
        this.data.workItems.forEach(item => {
            const status = item.status || 'new';
            if (!groupedItems[status]) groupedItems[status] = [];
            groupedItems[status].push(item);
        });

        // Render items in columns
        Object.entries(groupedItems).forEach(([status, items]) => {
            const column = columns[status];
            if (!column) return;

            items.forEach(item => {
                const card = this.createWorkItemCard(item);
                column.appendChild(card);
            });
        });

        // Update counts
        document.getElementById('newCount').textContent = (groupedItems.new || []).length;
        document.getElementById('progressCount').textContent = (groupedItems.in_progress || []).length;
        document.getElementById('reviewCount').textContent = (groupedItems.review || []).length;
        document.getElementById('doneCount').textContent = (groupedItems.done || []).length;
    }

    createWorkItemCard(item) {
        const card = document.createElement('div');
        card.className = 'work-item-card';
        card.setAttribute('data-type', item.type);
        card.setAttribute('data-id', item.id);

        const typeColors = {
            epic: '🎯',
            user_story: '📖',
            bug: '🐛'
        };

        const assigneeIcons = {
            developer: '👨‍💻',
            architect: '🏗️',
            tester: '🧪'
        };

        card.innerHTML = `
            <div class="work-item-header">
                <span class="work-item-type" data-type="${item.type}">
                    ${typeColors[item.type] || '📋'} ${item.type.replace('_', ' ')}
                </span>
                <span class="work-item-id">#${item.id}</span>
            </div>
            <div class="work-item-title">${this.escapeHtml(item.name)}</div>
            <div class="work-item-description">${this.escapeHtml(item.description)}</div>
            <div class="work-item-footer">
                <span class="work-item-assignee">
                    ${assigneeIcons[item.assigned_to] || '👤'} ${item.assigned_to}
                </span>
                <span class="work-item-date">${this.formatDate(item.created_at)}</span>
            </div>
        `;

        card.addEventListener('click', () => {
            this.showWorkItemDetails(item);
        });

        return card;
    }

    renderTasks() {
        const columns = {
            development: document.getElementById('devTasks'),
            testing: document.getElementById('testTasks'),
            review: document.getElementById('reviewTasks'),
            done: document.getElementById('completeTasks')
        };

        // Clear columns
        Object.values(columns).forEach(column => {
            column.innerHTML = '';
        });

        // Group tasks by type and status
        const groupedTasks = {
            development: [],
            testing: [],
            review: [],
            done: []
        };

        this.data.tasks.forEach(task => {
            if (task.status === 'done') {
                groupedTasks.done.push(task);
            } else if (task.type) {
                if (groupedTasks[task.type]) {
                    groupedTasks[task.type].push(task);
                }
            }
        });

        // Render tasks in columns
        Object.entries(groupedTasks).forEach(([type, tasks]) => {
            const column = columns[type];
            if (!column) return;

            tasks.slice(0, 5).forEach(task => { // Limit to 5 tasks per column
                const card = this.createTaskCard(task);
                column.appendChild(card);
            });

            if (tasks.length === 0) {
                const emptyState = document.createElement('div');
                emptyState.className = 'empty-state';
                emptyState.innerHTML = `
                    <div class="empty-state-icon">📭</div>
                    <div class="empty-state-description">No tasks</div>
                `;
                column.appendChild(emptyState);
            }
        });

        // Update counts
        document.getElementById('devTaskCount').textContent = groupedTasks.development.length;
        document.getElementById('testTaskCount').textContent = groupedTasks.testing.length;
        document.getElementById('reviewTaskCount').textContent = groupedTasks.review.length;
        document.getElementById('completeTaskCount').textContent = groupedTasks.done.length;
    }

    createTaskCard(task) {
        const card = document.createElement('div');
        card.className = 'task-card';
        card.setAttribute('data-type', task.type);
        card.setAttribute('data-id', task.id);

        const statusIcons = {
            new: '🆕',
            in_progress: '⚡',
            done: '✅',
            failed: '❌'
        };

        card.innerHTML = `
            <div class="task-title">${this.escapeHtml(task.work_item_name || `Task #${task.id}`)}</div>
            <div class="task-meta">
                <span class="task-status" data-status="${task.status}">
                    ${statusIcons[task.status] || '📋'} ${task.status.replace('_', ' ')}
                </span>
                <span class="task-id">#${task.id}</span>
            </div>
        `;

        card.addEventListener('click', () => {
            this.showTaskDetails(task);
        });

        return card;
    }

    renderAgents() {
        const agentList = document.getElementById('agentList');
        agentList.innerHTML = '';

        if (this.data.agents.length === 0) {
            agentList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🤖</div>
                    <div class="empty-state-description">No agents available</div>
                </div>
            `;
            return;
        }

        this.data.agents.forEach(agent => {
            const card = this.createAgentCard(agent);
            agentList.appendChild(card);
        });
    }

    createAgentCard(agent) {
        const card = document.createElement('div');
        card.className = 'agent-card';
        card.setAttribute('data-id', agent.id);

        const avatarIcons = {
            developer: '👨‍💻',
            architect: '🏗️',
            tester: '🧪',
            reviewer: '👁️'
        };

        const statusText = agent.status === 'working' 
            ? `Working on Task #${agent.current_task_id}`
            : 'Idle';

        card.innerHTML = `
            <div class="agent-avatar" data-type="${agent.type}">
                ${avatarIcons[agent.type] || '🤖'}
            </div>
            <div class="agent-info">
                <div class="agent-name">${agent.type}</div>
                <div class="agent-status ${agent.status}">${statusText}</div>
            </div>
        `;

        return card;
    }

    renderSchedulerStatus() {
        const toggle = document.getElementById('schedulerToggle');
        const icon = toggle.querySelector('.scheduler-icon');
        const text = toggle.querySelector('.scheduler-text');
        
        if (this.data.schedulerStatus?.isRunning) {
            icon.textContent = '⏸️';
            text.textContent = 'Stop';
            toggle.className = 'btn btn-secondary';
            this.updateSystemStatus('running', 'Scheduler Running');
        } else {
            icon.textContent = '▶️';
            text.textContent = 'Start';
            toggle.className = 'btn btn-primary';
            this.updateSystemStatus('warning', 'Scheduler Stopped');
        }
    }

    renderMetrics() {
        const totalWorkItems = this.data.workItems.length;
        const activeTasks = this.data.tasks.filter(t => t.status === 'in_progress').length;
        const completedWorkItems = this.data.workItems.filter(w => w.status === 'done').length;
        const completionRate = totalWorkItems > 0 ? Math.round((completedWorkItems / totalWorkItems) * 100) : 0;

        document.getElementById('totalWorkItems').textContent = totalWorkItems;
        document.getElementById('activeTasks').textContent = activeTasks;
        document.getElementById('completionRate').textContent = `${completionRate}%`;
    }

    renderActivityStream() {
        const stream = document.getElementById('activityStream');
        stream.innerHTML = '';

        // Generate mock activities based on current data
        const activities = this.generateActivityItems();

        if (activities.length === 0) {
            stream.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📡</div>
                    <div class="empty-state-description">No recent activity</div>
                </div>
            `;
            return;
        }

        activities.slice(0, 10).forEach(activity => {
            const item = this.createActivityItem(activity);
            stream.appendChild(item);
        });
    }

    generateActivityItems() {
        const activities = [];
        const now = new Date();

        // Add scheduler activities
        if (this.data.schedulerStatus?.lastRunAt) {
            activities.push({
                icon: '⚙️',
                message: 'Scheduler completed assignment cycle',
                time: this.data.schedulerStatus.lastRunAt
            });
        }

        // Add task activities
        this.data.tasks
            .filter(task => task.completed_at || task.started_at)
            .sort((a, b) => {
                const timeA = new Date(a.completed_at || a.started_at);
                const timeB = new Date(b.completed_at || b.started_at);
                return timeB - timeA;
            })
            .slice(0, 8)
            .forEach(task => {
                if (task.completed_at) {
                    activities.push({
                        icon: task.status === 'done' ? '✅' : '❌',
                        message: `Task #${task.id} (${task.type}) ${task.status === 'done' ? 'completed' : 'failed'}`,
                        time: task.completed_at
                    });
                } else if (task.started_at) {
                    activities.push({
                        icon: '🚀',
                        message: `Task #${task.id} (${task.type}) started`,
                        time: task.started_at
                    });
                }
            });

        // Add work item activities
        this.data.workItems
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 5)
            .forEach(item => {
                activities.push({
                    icon: '📋',
                    message: `Created ${item.type.replace('_', ' ')}: ${item.name}`,
                    time: item.created_at
                });
            });

        return activities.sort((a, b) => new Date(b.time) - new Date(a.time));
    }

    createActivityItem(activity) {
        const item = document.createElement('div');
        item.className = 'activity-item';

        item.innerHTML = `
            <div class="activity-icon">${activity.icon}</div>
            <div class="activity-content">
                <div class="activity-message">${this.escapeHtml(activity.message)}</div>
                <div class="activity-time">${this.formatRelativeTime(activity.time)}</div>
            </div>
        `;

        return item;
    }

    // Modal Management
    showCreateWorkItemModal() {
        this.showModal('createWorkItemModal');
        document.getElementById('workItemName').focus();
    }

    showActivityLogsModal() {
        this.showModal('activityLogsModal');
        this.loadActivityLogs();
    }

    showModal(modalId) {
        const overlay = document.getElementById('modalOverlay');
        const modal = document.getElementById(modalId);
        
        // Hide all modals first
        overlay.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
        
        // Show target modal
        modal.style.display = 'block';
        overlay.classList.add('active');
        
        // Trap focus
        const focusableElements = modal.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusableElements.length > 0) {
            focusableElements[0].focus();
        }
    }

    hideModal(modalId) {
        const overlay = document.getElementById('modalOverlay');
        overlay.classList.remove('active');
        setTimeout(() => {
            document.getElementById(modalId).style.display = 'none';
        }, 150);
    }

    hideAllModals() {
        const overlay = document.getElementById('modalOverlay');
        overlay.classList.remove('active');
        setTimeout(() => {
            overlay.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
        }, 150);
    }

    async loadActivityLogs() {
        const container = document.getElementById('logsContainer');
        container.innerHTML = `
            <div class="logs-placeholder">
                <span class="loading"></span>
                <p>Loading activity logs...</p>
            </div>
        `;

        // Simulate loading logs (in real implementation, this would fetch from an API)
        setTimeout(() => {
            const activities = this.generateActivityItems();
            const logsHtml = activities.map(activity => `
                <div style="margin-bottom: 8px; padding: 8px; background: var(--surface); border-radius: 4px;">
                    <span style="color: var(--text-tertiary);">[${this.formatTime(activity.time)}]</span>
                    <span style="margin: 0 8px;">${activity.icon}</span>
                    <span>${this.escapeHtml(activity.message)}</span>
                </div>
            `).join('');

            container.innerHTML = logsHtml || `
                <div class="logs-placeholder">
                    <span class="logs-icon">📋</span>
                    <p>No logs available</p>
                </div>
            `;
        }, 500);
    }

    // API Actions
    async createWorkItem() {
        const form = document.getElementById('createWorkItemForm');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);

        try {
            const response = await fetch(`${this.baseUrl}/api/work-items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create work item');
            }

            const result = await response.json();
            this.showToast(`Work item "${data.name}" created successfully`, 'success');
            this.hideModal('createWorkItemModal');
            form.reset();
            
            // Refresh data
            await this.loadWorkItems();
            this.renderWorkItems();
            this.renderMetrics();

        } catch (error) {
            console.error('Error creating work item:', error);
            this.showToast(error.message, 'error');
        }
    }

    async toggleScheduler() {
        const isRunning = this.data.schedulerStatus?.isRunning;
        const action = isRunning ? 'stop' : 'start';

        try {
            const response = await fetch(`${this.baseUrl}/api/scheduler/${action}`, {
                method: 'POST'
            });

            if (!response.ok) {
                throw new Error(`Failed to ${action} scheduler`);
            }

            const result = await response.json();
            this.showToast(result.message, 'success');
            
            // Refresh scheduler status
            await this.loadSchedulerStatus();
            this.renderSchedulerStatus();

        } catch (error) {
            console.error(`Error ${action}ing scheduler:`, error);
            this.showToast(error.message, 'error');
        }
    }

    // Auto-refresh
    startAutoRefresh() {
        this.refreshInterval = setInterval(async () => {
            try {
                await this.loadInitialData();
                this.renderAll();
            } catch (error) {
                console.error('Auto-refresh failed:', error);
            }
        }, 5000); // Refresh every 5 seconds
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    // Utility methods
    updateSystemStatus(type, message) {
        const indicator = document.getElementById('systemStatus');
        const dot = indicator.querySelector('.status-dot');
        const text = indicator.querySelector('.status-text');

        dot.className = `status-dot ${type}`;
        text.textContent = message;
    }

    filterWorkItems(filter) {
        const cards = document.querySelectorAll('.work-item-card');
        cards.forEach(card => {
            const type = card.getAttribute('data-type');
            const visible = filter === 'all' || type === filter;
            card.style.display = visible ? 'block' : 'none';
        });
    }

    showWorkItemDetails(item) {
        this.showToast(`Work Item #${item.id}: ${item.name}`, 'info');
    }

    showTaskDetails(task) {
        this.showToast(`Task #${task.id}: ${task.type}`, 'info');
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        container.appendChild(toast);
        
        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Auto-remove after 4 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 150);
        }, 4000);
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString();
    }

    formatTime(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleTimeString();
    }

    formatRelativeTime(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.waddleApp = new WaddleApp();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (window.waddleApp) {
        if (document.hidden) {
            window.waddleApp.stopAutoRefresh();
        } else {
            window.waddleApp.startAutoRefresh();
        }
    }
});

// Handle connection errors gracefully
window.addEventListener('online', () => {
    if (window.waddleApp) {
        window.waddleApp.showToast('Connection restored', 'success');
        window.waddleApp.loadInitialData();
    }
});

window.addEventListener('offline', () => {
    if (window.waddleApp) {
        window.waddleApp.showToast('Connection lost', 'warning');
    }
});