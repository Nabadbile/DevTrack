/* ==========================================================
   DevTrack — Frontend application
   Projects, tasks, dashboard statistics, search, filters,
   local persistence, and safe DOM rendering.
   ========================================================== */

'use strict';

const STORAGE_KEYS = {
    projects: 'devtrack-projects',
    projectsInitialized: 'devtrack-projects-initialized',
    tasks: 'devtrack-task-manager-v1'
};

const VALID_STATUSES = ['planning', 'in-progress', 'completed'];

const STATUS_LABELS = {
    planning: 'Planning',
    'in-progress': 'In Progress',
    completed: 'Completed'
};

const starterProjects = [
    {
        id: 'starter-business-website',
        name: 'Business Website',
        description: 'Building a modern website for a growing business.',
        status: 'in-progress',
        progress: 75,
        category: 'HTML · CSS · JavaScript',
        starter: true
    },
    {
        id: 'starter-ai-task-assistant',
        name: 'AI Task Assistant',
        description: 'Exploring smarter ways to organize daily tasks.',
        status: 'planning',
        progress: 25,
        category: 'AI · Automation',
        starter: true
    },
    {
        id: 'starter-personal-portfolio',
        name: 'Personal Portfolio',
        description: 'Showcasing skills, experience, and selected work.',
        status: 'completed',
        progress: 100,
        category: 'Web Development',
        starter: true
    }
];

const defaultTasks = [
    {
        id: 'task-starter-1',
        name: 'Review project requirements',
        project: 'Business Website',
        completed: false
    },
    {
        id: 'task-starter-2',
        name: 'Improve page layout',
        project: 'Business Website',
        completed: false
    },
    {
        id: 'task-starter-3',
        name: 'Learn a new CSS concept',
        project: 'Personal Development',
        completed: false
    },
    {
        id: 'task-starter-4',
        name: 'Plan the next milestone',
        project: 'AI Task Assistant',
        completed: false
    }
];

const elements = {
    projectForm: document.querySelector('#projectForm'),
    newProjectButton: document.querySelector('#newProjectBtn'),
    cancelProjectButton: document.querySelector('#cancelProjectBtn'),
    projectName: document.querySelector('#projectName'),
    projectDescription: document.querySelector('#projectDescription'),
    projectStatus: document.querySelector('#projectStatus'),
    projectProgress: document.querySelector('#projectProgress'),
    projectList: document.querySelector('#projectList'),
    projectSearch: document.querySelector('#projectSearch'),
    projectStatusFilter: document.querySelector('#projectStatusFilter'),
    totalProjects: document.querySelector('#totalProjects'),
    activeProjects: document.querySelector('#activeProjects'),
    completedTasks: document.querySelector('#completedTasks'),
    overallProgress: document.querySelector('#overallProgress'),
    taskList: document.querySelector('#taskList'),
    taskForm: document.querySelector('#taskForm'),
    addTaskButton: document.querySelector('#addTaskBtn'),
    cancelTaskButton: document.querySelector('#cancelTaskBtn'),
    taskName: document.querySelector('#taskName'),
    taskProject: document.querySelector('#taskProject'),
    taskFormHeading: document.querySelector('#taskFormHeading'),
    saveTaskButton: document.querySelector('#saveTaskBtn')
};

let projects = [];
let tasks = [];
let editingProjectId = null;
let editingTaskId = null;

/* -----------------------------
   Storage helpers
----------------------------- */

function readStorage(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        return JSON.parse(raw);
    } catch (error) {
        console.error(`Could not read ${key}:`, error);
        return fallback;
    }
}

function writeStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error(`Could not save ${key}:`, error);
        window.alert(
            'Your changes could not be saved in this browser. ' +
            'Check browser storage settings and try again.'
        );
        return false;
    }
}

function makeId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return `${prefix}-${window.crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/* -----------------------------
   Initial data and migration
----------------------------- */

function normalizeProject(project, index = 0) {
    const progressNumber = Number(project.progress);
    const progress = Number.isFinite(progressNumber)
        ? Math.min(100, Math.max(0, progressNumber))
        : 0;

    const status = VALID_STATUSES.includes(project.status)
        ? project.status
        : statusFromProgress(progress);

    return {
        id: typeof project.id === 'string' && project.id
            ? project.id
            : `project-migrated-${index}-${makeId('p')}`,
        name: String(project.name || 'Untitled project').trim(),
        description: String(project.description || '').trim(),
        status: progress === 100 ? 'completed' : status,
        progress,
        category: String(project.category || 'My Project'),
        starter: Boolean(project.starter)
    };
}

function statusFromProgress(progress) {
    if (progress <= 0) return 'planning';
    if (progress >= 100) return 'completed';
    return 'in-progress';
}

function initializeProjects() {
    const saved = readStorage(STORAGE_KEYS.projects, []);
    const existing = Array.isArray(saved)
        ? saved.filter(item => item && typeof item === 'object')
        : [];

    if (localStorage.getItem(STORAGE_KEYS.projectsInitialized) !== 'true') {
        // Migrate older versions: add the starter projects once, without
        // duplicating projects that are already stored under the same name.
        const names = new Set(existing.map(item =>
            String(item.name || '').trim().toLowerCase()
        ));

        const merged = [
            ...starterProjects.filter(project =>
                !names.has(project.name.toLowerCase())
            ),
            ...existing
        ].map(normalizeProject);

        if (writeStorage(STORAGE_KEYS.projects, merged)) {
            localStorage.setItem(STORAGE_KEYS.projectsInitialized, 'true');
        }
        projects = merged;
    } else {
        projects = existing.map(normalizeProject);
    }
}

function saveProjects() {
    return writeStorage(STORAGE_KEYS.projects, projects);
}

function initializeTasks() {
    const saved = readStorage(STORAGE_KEYS.tasks, null);

    if (saved === null) {
        tasks = defaultTasks.map(task => ({ ...task }));
        saveTasks();
        return;
    }

    tasks = Array.isArray(saved)
        ? saved
            .filter(task =>
                task &&
                typeof task.name === 'string' &&
                typeof task.project === 'string' &&
                typeof task.completed === 'boolean'
            )
            .map((task, index) => ({
                id: typeof task.id === 'string' && task.id
                    ? task.id
                    : `task-migrated-${index}-${makeId('t')}`,
                name: task.name.trim(),
                project: task.project.trim(),
                completed: task.completed
            }))
        : defaultTasks.map(task => ({ ...task }));
}

function saveTasks() {
    return writeStorage(STORAGE_KEYS.tasks, tasks);
}

/* -----------------------------
   Dashboard statistics
----------------------------- */

function updateDashboardStats() {
    const total = projects.length;
    const active = projects.filter(
        project => project.status === 'in-progress'
    ).length;
    const completed = tasks.filter(task => task.completed).length;
    const progressSum = projects.reduce(
        (sum, project) => sum + project.progress,
        0
    );
    const average = total ? Math.round(progressSum / total) : 0;

    elements.totalProjects.textContent = String(total).padStart(2, '0');
    elements.activeProjects.textContent = String(active).padStart(2, '0');
    elements.completedTasks.textContent = String(completed);
    elements.overallProgress.textContent = `${average}%`;
}

/* -----------------------------
   Project card rendering
----------------------------- */

function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function createProjectCard(project, index) {
    const article = createElement('article', 'project-card saved-project-card');
    article.dataset.projectId = project.id;

    const titleRow = createElement('div', 'project-title-row');
    const symbol = createElement(
        'div',
        'project-symbol violet',
        project.name.charAt(0).toUpperCase() || 'P'
    );
    symbol.setAttribute('aria-hidden', 'true');

    const status = createElement(
        'span',
        `status ${project.status}`,
        STATUS_LABELS[project.status]
    );
    titleRow.append(symbol, status);

    const title = createElement('h3', '', project.name);
    const description = createElement(
        'p',
        'project-description',
        project.description
    );

    const progressLabel = createElement('div', 'progress-label');
    progressLabel.append(
        createElement('span', '', 'Project progress'),
        createElement('strong', '', `${project.progress}%`)
    );

    const progressTrack = createElement('div', 'progress-track');
    progressTrack.setAttribute('role', 'progressbar');
    progressTrack.setAttribute('aria-label', `${project.name} progress`);
    progressTrack.setAttribute('aria-valuemin', '0');
    progressTrack.setAttribute('aria-valuemax', '100');
    progressTrack.setAttribute('aria-valuenow', String(project.progress));

    const progressFill = createElement(
        'div',
        `progress-fill ${project.status === 'completed' ? 'green-fill' :
            project.status === 'in-progress' ? 'violet-fill' : 'blue-fill'}`
    );
    progressFill.style.width = `${project.progress}%`;
    progressTrack.appendChild(progressFill);

    const footer = createElement('div', 'project-footer');
    const category = createElement('span', '', project.category || 'My Project');
    const number = createElement(
        'span',
        'project-number',
        String(index + 1).padStart(2, '0')
    );
    footer.append(category, number);

    const editButton = createElement('button', 'edit-project-button', 'Edit');
    editButton.type = 'button';
    editButton.setAttribute('aria-label', `Edit ${project.name}`);
    editButton.addEventListener('click', () => openProjectForm(project));

    const deleteButton = createElement('button', 'delete-project-button', 'Delete');
    deleteButton.type = 'button';
    deleteButton.setAttribute('aria-label', `Delete ${project.name}`);
    deleteButton.addEventListener('click', () => deleteProject(project.id));

    footer.append(editButton, deleteButton);
    article.append(titleRow, title, description, progressLabel, progressTrack, footer);
    return article;
}

function renderProjects() {
    elements.projectList.replaceChildren();

    projects.forEach((project, index) => {
        elements.projectList.appendChild(createProjectCard(project, index));
    });

    filterProjects();
    updateDashboardStats();
}

function filterProjects() {
    const searchTerm = elements.projectSearch.value.trim().toLowerCase();
    const selectedStatus = elements.projectStatusFilter.value;
    let visibleCount = 0;

    elements.projectList.querySelectorAll('.project-card').forEach(card => {
        const project = projects.find(item => item.id === card.dataset.projectId);
        if (!project) return;

        const matchesSearch =
            project.name.toLowerCase().includes(searchTerm) ||
            project.description.toLowerCase().includes(searchTerm) ||
            project.category.toLowerCase().includes(searchTerm);

        const matchesStatus =
            selectedStatus === 'all' || project.status === selectedStatus;

        const visible = matchesSearch && matchesStatus;
        card.hidden = !visible;
        if (visible) visibleCount += 1;
    });

    let message = document.querySelector('#noProjectsMessage');
    if (!message) {
        message = createElement(
            'p',
            'no-projects-message',
            'No projects found. Try another search or status.'
        );
        message.id = 'noProjectsMessage';
        message.setAttribute('role', 'status');
        elements.projectList.insertAdjacentElement('afterend', message);
    }
    message.hidden = visibleCount > 0;
}

/* -----------------------------
   Project form actions
----------------------------- */

function openProjectForm(project = null) {
    editingProjectId = project ? project.id : null;
    elements.projectForm.hidden = false;
    elements.projectForm.querySelector('h3').textContent =
        project ? 'Edit Project' : 'Create a New Project';
    elements.projectForm.querySelector('button[type="submit"]').textContent =
        project ? 'Save Changes' : 'Create Project';

    elements.projectName.value = project ? project.name : '';
    elements.projectDescription.value = project ? project.description : '';
    elements.projectStatus.value = project ? project.status : 'planning';
    elements.projectProgress.value = project ? project.progress : 0;

    elements.projectName.focus();
}

function resetProjectForm() {
    elements.projectForm.reset();
    elements.projectForm.hidden = true;
    editingProjectId = null;
    elements.projectForm.querySelector('h3').textContent = 'Create a New Project';
    elements.projectForm.querySelector('button[type="submit"]').textContent =
        'Create Project';
}

function deleteProject(projectId) {
    const project = projects.find(item => item.id === projectId);
    if (!project) return;

    const confirmed = window.confirm(`Are you sure you want to delete "${project.name}"?`);
    if (!confirmed) return;

    const previous = projects;
    projects = projects.filter(item => item.id !== projectId);

    if (!saveProjects()) {
        projects = previous;
        return;
    }

    if (editingProjectId === projectId) resetProjectForm();
    renderProjects();
}

function handleProjectSubmit(event) {
    event.preventDefault();

    const name = elements.projectName.value.trim();
    const description = elements.projectDescription.value.trim();
    const progressText = elements.projectProgress.value.trim();
    const progress = Number(progressText);
    const selectedStatus = elements.projectStatus.value;

    if (!name || !description || progressText === '' ||
        !Number.isFinite(progress) || progress < 0 || progress > 100) {
        window.alert('Enter a project name, description, and progress from 0 to 100.');
        return;
    }

    const duplicate = projects.some(project =>
        project.name.toLowerCase() === name.toLowerCase() &&
        project.id !== editingProjectId
    );

    if (duplicate) {
        window.alert('A project with that name already exists. Please choose another name.');
        elements.projectName.focus();
        return;
    }

    const status = progress === 100
        ? 'completed'
        : progress === 0 && selectedStatus === 'completed'
            ? 'planning'
            : selectedStatus;

    const projectData = {
        name,
        description,
        status: VALID_STATUSES.includes(status) ? status : statusFromProgress(progress),
        progress,
        category: editingProjectId
            ? (projects.find(item => item.id === editingProjectId)?.category || 'My Project')
            : 'My Project',
        starter: false
    };

    const previous = projects;

    if (editingProjectId) {
        projects = projects.map(project =>
            project.id === editingProjectId
                ? { ...project, ...projectData }
                : project
        );
    } else {
        projects = [...projects, { id: makeId('project'), ...projectData }];
    }

    if (!saveProjects()) {
        projects = previous;
        return;
    }

    resetProjectForm();
    renderProjects();
}

/* -----------------------------
   Task rendering and actions
----------------------------- */

function renderTasks() {
    elements.taskList.replaceChildren();

    if (tasks.length === 0) {
        const empty = createElement(
            'p',
            'empty-tasks-message',
            'No tasks yet. Select “Add Task” to create your first task.'
        );
        empty.setAttribute('role', 'status');
        elements.taskList.appendChild(empty);
    }

    tasks.forEach(task => {
        const item = createElement('div', 'task-item');
        item.dataset.taskId = task.id;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task.completed;
        checkbox.id = `check-${task.id}`;
        checkbox.setAttribute('aria-label', `Mark ${task.name} as completed`);
        checkbox.addEventListener('change', () => {
            const previous = task.completed;
            task.completed = checkbox.checked;
            if (!saveTasks()) task.completed = previous;
            renderTasks();
        });

        const details = createElement('div', 'task-details');
        const name = createElement(
            'strong',
            `task-name${task.completed ? ' task-completed' : ''}`,
            task.name
        );
        const project = createElement('span', 'task-project', task.project);
        details.append(name, project);

        const actions = createElement('div', 'task-actions');

        const editButton = createElement('button', 'edit-project-button', 'Edit');
        editButton.type = 'button';
        editButton.setAttribute('aria-label', `Edit task ${task.name}`);
        editButton.addEventListener('click', () => openTaskForm(task));

        const deleteButton = createElement('button', 'delete-project-button', 'Delete');
        deleteButton.type = 'button';
        deleteButton.setAttribute('aria-label', `Delete task ${task.name}`);
        deleteButton.addEventListener('click', () => deleteTask(task.id));

        actions.append(editButton, deleteButton);
        item.append(checkbox, details, actions);
        elements.taskList.appendChild(item);
    });

    updateDashboardStats();
}

function openTaskForm(task = null) {
    editingTaskId = task ? task.id : null;
    elements.taskForm.hidden = false;
    elements.taskFormHeading.textContent = task ? 'Edit Task' : 'Create a New Task';
    elements.saveTaskButton.textContent = task ? 'Save Changes' : 'Create Task';
    elements.taskName.value = task ? task.name : '';
    elements.taskProject.value = task ? task.project : '';
    elements.taskName.focus();
}

function resetTaskForm() {
    elements.taskForm.reset();
    elements.taskForm.hidden = true;
    editingTaskId = null;
    elements.taskFormHeading.textContent = 'Create a New Task';
    elements.saveTaskButton.textContent = 'Create Task';
}

function deleteTask(taskId) {
    const task = tasks.find(item => item.id === taskId);
    if (!task) return;

    if (!window.confirm(`Delete the task "${task.name}"?`)) return;

    const previous = tasks;
    tasks = tasks.filter(item => item.id !== taskId);

    if (!saveTasks()) {
        tasks = previous;
        return;
    }

    if (editingTaskId === taskId) resetTaskForm();
    renderTasks();
}

function handleTaskSubmit(event) {
    event.preventDefault();

    const name = elements.taskName.value.trim();
    const project = elements.taskProject.value.trim();

    if (!name || !project) {
        window.alert('Enter both a task name and its related project.');
        return;
    }

    const previous = tasks;

    if (editingTaskId) {
        tasks = tasks.map(task =>
            task.id === editingTaskId ? { ...task, name, project } : task
        );
    } else {
        tasks = [...tasks, {
            id: makeId('task'),
            name,
            project,
            completed: false
        }];
    }

    if (!saveTasks()) {
        tasks = previous;
        return;
    }

    resetTaskForm();
    renderTasks();
}

/* -----------------------------
   Navigation and accessibility
----------------------------- */

function setupNavigation() {
    const links = [...document.querySelectorAll('.nav-link')];

    function updateActiveLink() {
        const hash = window.location.hash || '#dashboard';
        links.forEach(link => {
            const active = link.getAttribute('href') === hash;
            link.classList.toggle('active', active);
            if (active) link.setAttribute('aria-current', 'location');
            else link.removeAttribute('aria-current');
        });
    }

    links.forEach(link => {
        link.addEventListener('click', () => {
            links.forEach(item => item.classList.remove('active'));
            link.classList.add('active');
        });
    });

    window.addEventListener('hashchange', updateActiveLink);
    updateActiveLink();
}

/* -----------------------------
   App startup
----------------------------- */

function startApp() {
    initializeProjects();
    initializeTasks();

    elements.newProjectButton.addEventListener('click', () => openProjectForm());
    elements.cancelProjectButton.addEventListener('click', resetProjectForm);
    elements.projectForm.addEventListener('submit', handleProjectSubmit);
    elements.projectSearch.addEventListener('input', filterProjects);
    elements.projectStatusFilter.addEventListener('change', filterProjects);

    elements.addTaskButton.addEventListener('click', () => openTaskForm());
    elements.cancelTaskButton.addEventListener('click', resetTaskForm);
    elements.taskForm.addEventListener('submit', handleTaskSubmit);

    setupNavigation();
    renderProjects();
    renderTasks();
}

startApp();
