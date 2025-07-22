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

        // Delete modal events
        document.getElementById('closeDeleteModal').addEventListener('click', () => {
            this.hideModal('deleteWorkItemModal');
        });

        document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
            this.hideModal('deleteWorkItemModal');
        });

        document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
            this.executeDelete();
        });

        // Delete confirmation input validation
        document.getElementById('deleteConfirmation').addEventListener('input', (e) => {
            this.validateDeleteConfirmation(e.target.value);
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
                this.loadAgents()
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


    renderAll() {
        this.renderWorkItems();
        this.renderTasks();
        this.renderAgents();
        this.renderMetrics();
        this.renderActivityStream();
    }

    renderWorkItems() {
        const columns = {
            new: document.getElementById('newColumn'),
            in_progress: document.getElementById('progressColumn'),
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
            <div class="work-item-actions">
                <button class="btn-delete" data-id="${item.id}" title="Delete work item">×</button>
            </div>
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

        // Add click handler for the card (excluding the delete button)
        card.addEventListener('click', (e) => {
            // Prevent showing details when clicking the delete button
            if (e.target.classList.contains('btn-delete')) {
                return;
            }
            this.showWorkItemDetails(item);
        });

        // Add delete button handler
        const deleteBtn = card.querySelector('.btn-delete');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card click
            // Bypass confirmation modal - delete directly
            this.currentDeleteItem = item;
            this.executeDelete();
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

        const canStart = task.status === 'new' || task.status === 'failed';
        const isRunning = task.status === 'in_progress';
        
        card.innerHTML = `
            <div class="task-title">${this.escapeHtml(task.work_item_name || `Task #${task.id}`)}</div>
            <div class="task-meta">
                <span class="task-status" data-status="${task.status}">
                    ${statusIcons[task.status] || '📋'} ${task.status.replace('_', ' ')}
                </span>
                <span class="task-id">#${task.id}</span>
            </div>
            ${canStart ? `
                <div class="task-actions">
                    <button class="btn-task-start" data-task-id="${task.id}" data-task-type="${task.type}">
                        ▶️ Start ${task.type}
                    </button>
                </div>
            ` : ''}
            ${isRunning ? `
                <div class="task-progress">
                    <div class="loading"></div>
                    <span>Processing...</span>
                </div>
            ` : ''}
        `;

        // Add click handler for task details (but not on buttons)
        card.addEventListener('click', (e) => {
            if (!e.target.classList.contains('btn-task-start')) {
                this.showTaskDetails(task);
            }
        });

        // Add click handler for start button
        const startBtn = card.querySelector('.btn-task-start');
        if (startBtn) {
            startBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.startTask(task.id, task.type);
            });
        }

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
        this.loadBranchOptions();
        this.setupBranchSelection();
    }

    showActivityLogsModal() {
        this.showModal('activityLogsModal');
        this.loadActivityLogs();
    }

    showDeleteConfirmation(workItem) {
        this.currentDeleteItem = workItem;
        
        // Populate the work item preview
        const previewContainer = document.getElementById('deleteWorkItemPreview');
        previewContainer.innerHTML = `
            <div class="preview-item">
                <span class="preview-label">Name:</span>
                <span class="preview-value">${this.escapeHtml(workItem.name)}</span>
            </div>
            <div class="preview-item">
                <span class="preview-label">Type:</span>
                <span class="preview-value">${workItem.type.replace('_', ' ')}</span>
            </div>
            <div class="preview-item">
                <span class="preview-label">Status:</span>
                <span class="preview-value">${workItem.status}</span>
            </div>
            <div class="preview-item">
                <span class="preview-label">Assigned to:</span>
                <span class="preview-value">${workItem.assigned_to}</span>
            </div>
            <div class="preview-item">
                <span class="preview-label">Created:</span>
                <span class="preview-value">${this.formatDate(workItem.created_at)}</span>
            </div>
        `;

        // Set expected name for confirmation
        document.getElementById('expectedName').textContent = workItem.name;
        
        // Clear previous input
        const confirmationInput = document.getElementById('deleteConfirmation');
        confirmationInput.value = '';
        confirmationInput.classList.remove('valid');
        
        // Disable confirm button
        document.getElementById('confirmDeleteBtn').disabled = true;
        
        this.showModal('deleteWorkItemModal');
        confirmationInput.focus();
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

    validateDeleteConfirmation(inputValue) {
        const expectedName = this.currentDeleteItem?.name || '';
        const confirmButton = document.getElementById('confirmDeleteBtn');
        const confirmationInput = document.getElementById('deleteConfirmation');
        
        const isValid = inputValue.trim() === expectedName;
        
        if (isValid) {
            confirmationInput.classList.add('valid');
            confirmButton.disabled = false;
        } else {
            confirmationInput.classList.remove('valid');
            confirmButton.disabled = true;
        }
    }

    async executeDelete() {
        if (!this.currentDeleteItem) {
            this.showToast('Error: No work item selected for deletion', 'error');
            return;
        }

        const workItem = this.currentDeleteItem;
        const confirmButton = document.getElementById('confirmDeleteBtn');
        
        // Show loading state
        confirmButton.innerHTML = '<span class="loading"></span> Deleting...';
        confirmButton.disabled = true;

        try {
            const response = await fetch(`/api/work-items/${workItem.id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const result = await response.json();

            if (result.success) {
                this.showToast(result.message, 'success');
                
                // Remove the work item from data
                this.data.workItems = this.data.workItems.filter(item => item.id !== workItem.id);
                
                // Re-render the work items board
                this.renderWorkItems();
                this.renderMetrics();
                
                // Hide the modal
                this.hideModal('deleteWorkItemModal');
                
                // Clear current delete item
                this.currentDeleteItem = null;
            } else {
                this.showToast(result.message || 'Failed to delete work item', 'error');
            }
        } catch (error) {
            this.showToast('Network error: Failed to delete work item', 'error');
            console.error('Delete error:', error);
        } finally {
            // Restore button state
            confirmButton.innerHTML = 'Delete Work Item';
            confirmButton.disabled = false;
        }
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

    // Branch Selection Methods
    async loadBranchOptions() {
        try {
            const response = await fetch(`${this.baseUrl}/api/branches/local`);
            if (!response.ok) throw new Error('Failed to fetch branches');
            
            const result = await response.json();
            const select = document.getElementById('existingBranchSelect');
            
            // Clear existing options except the first one
            select.innerHTML = '<option value="">Select a branch...</option>';
            
            // Add branches to select
            result.branches.forEach(branch => {
                const option = document.createElement('option');
                option.value = branch;
                option.textContent = branch;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading branches:', error);
            this.showToast('Failed to load branches', 'error');
        }
    }

    setupBranchSelection() {
        const newBranchRadio = document.getElementById('newBranchRadio');
        const existingBranchRadio = document.getElementById('existingBranchRadio');
        const newBranchCard = document.querySelector('label[for="newBranchRadio"]');
        const existingBranchCard = document.querySelector('label[for="existingBranchRadio"]');
        const newBranchInput = document.getElementById('newBranchName');
        const existingBranchSelect = document.getElementById('existingBranchSelect');
        const nameInput = document.getElementById('workItemName');

        let isUserEditingBranchName = false;

        // Generate branch name slug from work item name
        const generateBranchSlug = (name) => {
            return name.toLowerCase()
                       .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
                       .replace(/\s+/g, '-')         // Replace spaces with hyphens
                       .replace(/-+/g, '-')          // Replace multiple hyphens with single hyphen
                       .replace(/^-|-$/g, '');       // Remove leading/trailing hyphens
        };

        // Handle card selection visual states
        const updateCardStates = () => {
            if (newBranchRadio.checked) {
                newBranchCard.classList.add('active');
                existingBranchCard.classList.remove('active');
                newBranchInput.disabled = false;
                existingBranchSelect.disabled = true;
                this.updateBranchPlaceholder();
            } else {
                newBranchCard.classList.remove('active');
                existingBranchCard.classList.add('active');
                newBranchInput.disabled = true;
                existingBranchSelect.disabled = false;
            }
        };

        // Update branch name placeholder based on work item name
        const updateBranchPlaceholder = () => {
            const name = nameInput.value.trim();
            if (name && newBranchRadio.checked) {
                const slug = generateBranchSlug(name);
                // Show clean branch name to user (backend will add work-item-ID for database compliance)
                const suggestedBranch = slug ? `feature/${slug}` : 'feature/branch-name';
                newBranchInput.placeholder = suggestedBranch;
                
                // Auto-fill the input if user hasn't manually edited it
                if (!isUserEditingBranchName) {
                    newBranchInput.value = suggestedBranch;
                }
            } else {
                newBranchInput.placeholder = 'feature/branch-name';
                if (!isUserEditingBranchName) {
                    newBranchInput.value = '';
                }
            }
        };

        this.updateBranchPlaceholder = updateBranchPlaceholder;

        // Track when user manually edits the branch name
        newBranchInput.addEventListener('input', (e) => {
            isUserEditingBranchName = true;
            // If user clears the field, reset to auto-generated mode
            if (e.target.value === '') {
                isUserEditingBranchName = false;
                updateBranchPlaceholder();
            }
        });

        // Reset user editing state when they focus on the input and it's empty
        newBranchInput.addEventListener('focus', () => {
            if (newBranchInput.value === '' || newBranchInput.value === newBranchInput.placeholder) {
                isUserEditingBranchName = false;
                updateBranchPlaceholder();
            }
        });

        // Event listeners for radio buttons
        newBranchRadio.addEventListener('change', () => {
            isUserEditingBranchName = false; // Reset editing state when switching
            updateCardStates();
        });
        
        existingBranchRadio.addEventListener('change', updateCardStates);
        
        // Event listener for work item name changes
        nameInput.addEventListener('input', () => {
            // Only update if user hasn't manually edited the branch name
            if (!isUserEditingBranchName && newBranchRadio.checked) {
                updateBranchPlaceholder();
            }
        });

        // Initialize states
        updateCardStates();
    }

    // API Actions
    async createWorkItem() {
        const form = document.getElementById('createWorkItemForm');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);

        // Handle branch selection
        const branchOption = document.querySelector('input[name="branch_option"]:checked').value;
        if (branchOption === 'new') {
            data.create_new_branch = true;
            // Get the custom branch name if user has entered one
            const customBranchName = document.getElementById('newBranchName').value.trim();
            if (customBranchName) {
                data.custom_branch_name = customBranchName;
            }
        } else {
            data.branch_name = document.getElementById('existingBranchSelect').value;
            data.create_new_branch = false;
            
            // Validate that a branch is selected
            if (!data.branch_name) {
                this.showToast('Please select a branch or choose to create a new one', 'error');
                return;
            }
        }

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


    async startTask(taskId, taskType) {
        try {
            this.showToast(`Starting ${taskType} task #${taskId}...`, 'info');
            
            const response = await fetch(`${this.baseUrl}/api/tasks/${taskId}/process`, {
                method: 'POST'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `Failed to start task #${taskId}`);
            }

            const result = await response.json();
            
            if (result.status === 'in_progress') {
                this.showToast(result.message || 'Task is already running', 'warning');
            } else {
                this.showToast(`${taskType} task #${taskId} started successfully!`, 'success');
                
                // Refresh data immediately to show updated status
                await this.loadTasks();
                await this.loadWorkItems();
                this.renderTasks();
                this.renderWorkItems();
                this.renderMetrics();
            }

        } catch (error) {
            console.error('Error starting task:', error);
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