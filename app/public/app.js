/**
 * Task Tracker - Logic Frontend (Vanilla JavaScript)
 * - Tuong thich tuyet doi Content-Security-Policy: default-src 'self'
 * - Phong chong XSS triet de: tat ca du lieu nguoi dung deu dung textContent hoac thuoc tinh an toan, khong dung innerHTML voi user data
 * - Khong su dung bat ky thu vien ngoai hay inline script
 */

// Bien toan cuc quan ly trang thai
let state = {
  tasks: [],
  projects: [],
  users: [],
  stats: { total: 0, todo: 0, in_progress: 0, done: 0, overdue: 0 },
  editingTaskId: null,
  taskToDeleteId: null,
};

// DOM Elements Cache
const DOM = {
  // Stats
  statTotal: document.getElementById('stat-total'),
  statTodo: document.getElementById('stat-todo'),
  statProgress: document.getElementById('stat-progress'),
  statDone: document.getElementById('stat-done'),
  statOverdue: document.getElementById('stat-overdue'),

  // Form task
  taskForm: document.getElementById('task-form'),
  formHeading: document.getElementById('form-heading'),
  taskIdInput: document.getElementById('task-id'),
  taskTitle: document.getElementById('task-title'),
  taskDeadline: document.getElementById('task-deadline'),
  taskPriority: document.getElementById('task-priority'),
  taskDesc: document.getElementById('task-desc'),
  taskProject: document.getElementById('task-project'),
  taskAssignee: document.getElementById('task-assignee'),
  btnCancelEdit: document.getElementById('btn-cancel-edit'),
  btnSubmitTask: document.getElementById('btn-submit-task'),

  // Filters
  filterQ: document.getElementById('filter-q'),
  filterStatus: document.getElementById('filter-status'),
  filterProject: document.getElementById('filter-project'),
  filterAssignee: document.getElementById('filter-assignee'),
  btnResetFilters: document.getElementById('btn-reset-filters'),
  btnRefresh: document.getElementById('btn-refresh'),

  // Kanban Columns
  cardsTodo: document.getElementById('cards-todo'),
  cardsProgress: document.getElementById('cards-in_progress'),
  cardsDone: document.getElementById('cards-done'),
  countTodo: document.getElementById('count-todo'),
  countProgress: document.getElementById('count-in_progress'),
  countDone: document.getElementById('count-done'),

  // Modals & Toasts
  toastContainer: document.getElementById('toast-container'),

  // Project Modal
  modalProject: document.getElementById('modal-project'),
  modalProjectBackdrop: document.getElementById('modal-project-backdrop'),
  btnCloseProjectModal: document.getElementById('btn-close-project-modal'),
  btnOpenProjectModal: document.getElementById('btn-open-project-modal'),
  formNewProject: document.getElementById('form-new-project'),
  newProjectName: document.getElementById('new-project-name'),
  newProjectDesc: document.getElementById('new-project-desc'),
  projectListItems: document.getElementById('project-list-items'),

  // User Modal
  modalUser: document.getElementById('modal-user'),
  modalUserBackdrop: document.getElementById('modal-user-backdrop'),
  btnCloseUserModal: document.getElementById('btn-close-user-modal'),
  btnOpenUserModal: document.getElementById('btn-open-user-modal'),
  formNewUser: document.getElementById('form-new-user'),
  newUserName: document.getElementById('new-user-name'),
  newUserEmail: document.getElementById('new-user-email'),
  userListItems: document.getElementById('user-list-items'),

  // Confirm Delete Modal
  modalConfirm: document.getElementById('modal-confirm'),
  modalConfirmBackdrop: document.getElementById('modal-confirm-backdrop'),
  btnCloseConfirmModal: document.getElementById('btn-close-confirm-modal'),
  btnConfirmCancel: document.getElementById('btn-confirm-cancel'),
  btnConfirmOk: document.getElementById('btn-confirm-ok'),
  confirmMessage: document.getElementById('confirm-message'),
};

// ==========================================
// 1. THONG BAO TOAST
// ==========================================
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(30px)';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, 3500);
}

// ==========================================
// 2. FETCH API HELPER
// ==========================================
async function apiRequest(url, options = {}) {
  const defaultHeaders = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
  };

  try {
    const res = await fetch(url, config);
    if (res.status === 204) return null;

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Yêu cầu thất bại (${res.status})`);
    }
    return data;
  } catch (err) {
    showToast(err.message, 'error');
    throw err;
  }
}

// ==========================================
// 3. LOAD DATA TU SERVER
// ==========================================
async function fetchStats() {
  try {
    const stats = await apiRequest('/api/stats');
    state.stats = stats;
    DOM.statTotal.textContent = stats.total || 0;
    DOM.statTodo.textContent = stats.todo || 0;
    DOM.statProgress.textContent = stats.in_progress || 0;
    DOM.statDone.textContent = stats.done || 0;
    DOM.statOverdue.textContent = stats.overdue || 0;
  } catch (err) {
    console.error('Loi tai thong ke:', err);
  }
}

async function fetchProjects() {
  try {
    state.projects = await apiRequest('/api/projects');
    renderProjectOptions();
    renderProjectListModal();
  } catch (err) {
    console.error('Loi tai danh sach nhom:', err);
  }
}

async function fetchUsers() {
  try {
    state.users = await apiRequest('/api/users');
    renderUserOptions();
    renderUserListModal();
  } catch (err) {
    console.error('Loi tai danh sach nguoi dung:', err);
  }
}

async function fetchTasks() {
  try {
    const params = new URLSearchParams();
    const q = DOM.filterQ.value.trim();
    const status = DOM.filterStatus.value;
    const project_id = DOM.filterProject.value;
    const assignee_id = DOM.filterAssignee.value;

    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (project_id) params.set('project_id', project_id);
    if (assignee_id) params.set('assignee_id', assignee_id);

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    state.tasks = await apiRequest(`/api/tasks${queryStr}`);
    renderKanbanBoard();
  } catch (err) {
    console.error('Loi tai danh sach task:', err);
  }
}

async function reloadAll() {
  await Promise.all([fetchStats(), fetchProjects(), fetchUsers(), fetchTasks()]);
}

// ==========================================
// 4. RENDER OPTIONS & MODAL LISTS (CHONG XSS)
// ==========================================
function renderProjectOptions() {
  // Luu lai gia tri dang chon (neu co)
  const currentFormVal = DOM.taskProject.value;
  const currentFilterVal = DOM.filterProject.value;

  // Xoa cac option cu
  while (DOM.taskProject.children.length > 1) {
    DOM.taskProject.removeChild(DOM.taskProject.lastChild);
  }
  while (DOM.filterProject.children.length > 1) {
    DOM.filterProject.removeChild(DOM.filterProject.lastChild);
  }

  state.projects.forEach((proj) => {
    // Option cho Form
    const optForm = document.createElement('option');
    optForm.value = proj.id;
    optForm.textContent = proj.name; // Safe against XSS
    DOM.taskProject.appendChild(optForm);

    // Option cho Filter
    const optFilter = document.createElement('option');
    optFilter.value = proj.id;
    optFilter.textContent = proj.name;
    DOM.filterProject.appendChild(optFilter);
  });

  DOM.taskProject.value = currentFormVal;
  DOM.filterProject.value = currentFilterVal;
}

function renderUserOptions() {
  const currentFormVal = DOM.taskAssignee.value;
  const currentFilterVal = DOM.filterAssignee.value;

  while (DOM.taskAssignee.children.length > 1) {
    DOM.taskAssignee.removeChild(DOM.taskAssignee.lastChild);
  }
  while (DOM.filterAssignee.children.length > 1) {
    DOM.filterAssignee.removeChild(DOM.filterAssignee.lastChild);
  }

  state.users.forEach((u) => {
    const optForm = document.createElement('option');
    optForm.value = u.id;
    optForm.textContent = `${u.full_name} (${u.email})`;
    DOM.taskAssignee.appendChild(optForm);

    const optFilter = document.createElement('option');
    optFilter.value = u.id;
    optFilter.textContent = u.full_name;
    DOM.filterAssignee.appendChild(optFilter);
  });

  DOM.taskAssignee.value = currentFormVal;
  DOM.filterAssignee.value = currentFilterVal;
}

function renderProjectListModal() {
  while (DOM.projectListItems.firstChild) {
    DOM.projectListItems.removeChild(DOM.projectListItems.firstChild);
  }
  if (!state.projects.length) {
    const li = document.createElement('li');
    li.className = 'empty-state';
    li.textContent = 'Chưa có nhóm nào';
    DOM.projectListItems.appendChild(li);
    return;
  }
  state.projects.forEach((p) => {
    const li = document.createElement('li');
    li.className = 'item-list-row';
    const nameSpan = document.createElement('strong');
    nameSpan.textContent = p.name;
    const descSpan = document.createElement('span');
    descSpan.textContent = p.description || 'Không có mô tả';
    li.appendChild(nameSpan);
    li.appendChild(descSpan);
    DOM.projectListItems.appendChild(li);
  });
}

function renderUserListModal() {
  while (DOM.userListItems.firstChild) {
    DOM.userListItems.removeChild(DOM.userListItems.firstChild);
  }
  if (!state.users.length) {
    const li = document.createElement('li');
    li.className = 'empty-state';
    li.textContent = 'Chưa có người dùng nào';
    DOM.userListItems.appendChild(li);
    return;
  }
  state.users.forEach((u) => {
    const li = document.createElement('li');
    li.className = 'item-list-row';
    const nameSpan = document.createElement('strong');
    nameSpan.textContent = u.full_name;
    const emailSpan = document.createElement('span');
    emailSpan.textContent = u.email;
    li.appendChild(nameSpan);
    li.appendChild(emailSpan);
    DOM.userListItems.appendChild(li);
  });
}

// ==========================================
// 5. RENDER KANBAN BOARD (CHONG XSS HOAN TOAN)
// ==========================================
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatInputDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${year}-${month}-${day}`;
}

function getPriorityLabel(priority) {
  switch (priority) {
    case 'high': return 'Cao';
    case 'medium': return 'Trung bình';
    case 'low': return 'Thấp';
    default: return priority;
  }
}

function renderKanbanBoard() {
  // Xoa sach the hien tai
  while (DOM.cardsTodo.firstChild) DOM.cardsTodo.removeChild(DOM.cardsTodo.firstChild);
  while (DOM.cardsProgress.firstChild) DOM.cardsProgress.removeChild(DOM.cardsProgress.firstChild);
  while (DOM.cardsDone.firstChild) DOM.cardsDone.removeChild(DOM.cardsDone.firstChild);

  const todoTasks = state.tasks.filter((t) => t.status === 'todo');
  const progressTasks = state.tasks.filter((t) => t.status === 'in_progress');
  const doneTasks = state.tasks.filter((t) => t.status === 'done');

  DOM.countTodo.textContent = todoTasks.length;
  DOM.countProgress.textContent = progressTasks.length;
  DOM.countDone.textContent = doneTasks.length;

  appendCardsToColumn(DOM.cardsTodo, todoTasks, 'todo');
  appendCardsToColumn(DOM.cardsProgress, progressTasks, 'in_progress');
  appendCardsToColumn(DOM.cardsDone, doneTasks, 'done');
}

function appendCardsToColumn(container, tasks, colStatus) {
  if (tasks.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-state';
    emptyDiv.textContent = 'Không có công việc nào';
    container.appendChild(emptyDiv);
    return;
  }

  tasks.forEach((task) => {
    const card = createTaskCard(task);
    container.appendChild(card);
  });
}

function createTaskCard(task) {
  const card = document.createElement('div');
  card.className = `task-card priority-${task.priority}`;
  if (task.overdue) {
    card.classList.add('is-overdue');
  }

  // 1. Header the
  const header = document.createElement('div');
  header.className = 'task-header';

  const titleEl = document.createElement('div');
  titleEl.className = 'task-title';
  titleEl.textContent = task.title; // CHONG XSS: luon dung textContent

  const badge = document.createElement('span');
  badge.className = `task-priority-badge badge-${task.priority}`;
  badge.textContent = getPriorityLabel(task.priority);

  header.appendChild(titleEl);
  header.appendChild(badge);
  card.appendChild(header);

  // 2. Mo ta (neu co)
  if (task.description && task.description.trim()) {
    const descEl = document.createElement('div');
    descEl.className = 'task-desc';
    descEl.textContent = task.description; // CHONG XSS
    card.appendChild(descEl);
  }

  // 3. Meta: Deadline, Nhom, Nguoi thuc hien
  const meta = document.createElement('div');
  meta.className = 'task-meta';

  // Hang 1: Deadline & Canh bao qua han
  const deadlineRow = document.createElement('div');
  deadlineRow.className = 'meta-row';

  const deadlineLabel = document.createElement('span');
  deadlineLabel.textContent = 'Hạn: ';

  const deadlineVal = document.createElement('span');
  deadlineVal.className = 'meta-deadline';
  if (task.deadline) {
    const formattedDate = formatDate(task.deadline);
    if (task.overdue) {
      deadlineVal.className += ' deadline-overdue';
      deadlineVal.textContent = `${formattedDate} (Quá hạn!)`;
    } else {
      deadlineVal.textContent = formattedDate;
    }
  } else {
    deadlineVal.textContent = 'Không có';
  }
  deadlineRow.appendChild(deadlineLabel);
  deadlineRow.appendChild(deadlineVal);
  meta.appendChild(deadlineRow);

  // Hang 2: Nhom
  const projRow = document.createElement('div');
  projRow.className = 'meta-row';
  const projLabel = document.createElement('span');
  projLabel.textContent = 'Nhóm: ';
  const projVal = document.createElement('strong');
  projVal.textContent = task.project_name || 'Chưa gán';
  projRow.appendChild(projLabel);
  projRow.appendChild(projVal);
  meta.appendChild(projRow);

  // Hang 3: Nguoi thuc hien
  const userRow = document.createElement('div');
  userRow.className = 'meta-row';
  const userLabel = document.createElement('span');
  userLabel.textContent = 'Người làm: ';
  const userVal = document.createElement('strong');
  userVal.textContent = task.assignee_name || 'Chưa phân công';
  userRow.appendChild(userLabel);
  userRow.appendChild(userVal);
  meta.appendChild(userRow);

  card.appendChild(meta);

  // 4. Nut hanh dong (Action buttons)
  const actions = document.createElement('div');
  actions.className = 'task-actions';

  // Nhom chuyen cot
  const shifts = document.createElement('div');
  shifts.className = 'action-shifts';

  if (task.status === 'todo') {
    const btnToProgress = document.createElement('button');
    btnToProgress.type = 'button';
    btnToProgress.className = 'btn btn-secondary btn-sm';
    btnToProgress.textContent = 'Bắt đầu \u2192';
    btnToProgress.addEventListener('click', () => changeTaskStatus(task.id, 'in_progress'));
    shifts.appendChild(btnToProgress);
  } else if (task.status === 'in_progress') {
    const btnToTodo = document.createElement('button');
    btnToTodo.type = 'button';
    btnToTodo.className = 'btn btn-secondary btn-sm';
    btnToTodo.textContent = '\u2190 Cần làm';
    btnToTodo.addEventListener('click', () => changeTaskStatus(task.id, 'todo'));
    shifts.appendChild(btnToTodo);

    const btnToDone = document.createElement('button');
    btnToDone.type = 'button';
    btnToDone.className = 'btn btn-primary btn-sm';
    btnToDone.textContent = 'Xong \u2713';
    btnToDone.addEventListener('click', () => changeTaskStatus(task.id, 'done'));
    shifts.appendChild(btnToDone);
  } else if (task.status === 'done') {
    const btnReopen = document.createElement('button');
    btnReopen.type = 'button';
    btnReopen.className = 'btn btn-secondary btn-sm';
    btnReopen.textContent = '\u2190 Đang làm';
    btnReopen.addEventListener('click', () => changeTaskStatus(task.id, 'in_progress'));
    shifts.appendChild(btnReopen);
  }

  // Nhom Chinh sua & Xoa
  const crud = document.createElement('div');
  crud.className = 'action-crud';

  const btnEdit = document.createElement('button');
  btnEdit.type = 'button';
  btnEdit.className = 'btn btn-outline btn-sm';
  btnEdit.textContent = 'Sửa';
  btnEdit.addEventListener('click', () => startEditTask(task));
  crud.appendChild(btnEdit);

  const btnDelete = document.createElement('button');
  btnDelete.type = 'button';
  btnDelete.className = 'btn btn-danger btn-sm';
  btnDelete.textContent = 'Xóa';
  btnDelete.addEventListener('click', () => promptDeleteTask(task));
  crud.appendChild(btnDelete);

  actions.appendChild(shifts);
  actions.appendChild(crud);
  card.appendChild(actions);

  return card;
}

// ==========================================
// 6. XU LY THAO TAC FORM VA CRUD
// ==========================================
async function changeTaskStatus(taskId, newStatus) {
  try {
    await apiRequest(`/api/tasks/${taskId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus }),
    });
    showToast('Đã cập nhật trạng thái công việc', 'success');
    await Promise.all([fetchStats(), fetchTasks()]);
  } catch (err) {
    // Loi da duoc showToast trong apiRequest
  }
}

function startEditTask(task) {
  state.editingTaskId = task.id;
  DOM.formHeading.textContent = `Chỉnh sửa công việc #${task.id}`;
  DOM.taskIdInput.value = task.id;
  DOM.taskTitle.value = task.title;
  DOM.taskDesc.value = task.description || '';
  DOM.taskPriority.value = task.priority;
  DOM.taskDeadline.value = formatInputDate(task.deadline);
  DOM.taskProject.value = task.project_id || '';
  DOM.taskAssignee.value = task.assignee_id || '';

  DOM.btnCancelEdit.classList.remove('hidden');
  DOM.btnSubmitTask.textContent = 'Lưu thay đổi';

  // Cuon nhe len form
  DOM.taskForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
  DOM.taskTitle.focus();
}

function cancelEditTask() {
  state.editingTaskId = null;
  DOM.formHeading.textContent = 'Thêm công việc mới';
  DOM.taskForm.reset();
  DOM.taskIdInput.value = '';
  DOM.btnCancelEdit.classList.add('hidden');
  DOM.btnSubmitTask.textContent = 'Lưu công việc';
}

DOM.btnCancelEdit.addEventListener('click', cancelEditTask);

DOM.taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = DOM.taskTitle.value.trim();
  if (!title) {
    showToast('Tiêu đề công việc là bắt buộc', 'error');
    DOM.taskTitle.focus();
    return;
  }
  if (title.length > 200) {
    showToast('Tiêu đề không được vượt quá 200 ký tự', 'error');
    return;
  }

  const payload = {
    title,
    description: DOM.taskDesc.value.trim(),
    priority: DOM.taskPriority.value,
    deadline: DOM.taskDeadline.value || null,
    project_id: DOM.taskProject.value ? Number(DOM.taskProject.value) : null,
    assignee_id: DOM.taskAssignee.value ? Number(DOM.taskAssignee.value) : null,
  };

  try {
    if (state.editingTaskId) {
      // Che do cap nhat (PUT)
      // Giu nguyen status hien tai
      const existing = state.tasks.find((t) => t.id === state.editingTaskId);
      payload.status = existing ? existing.status : 'todo';

      await apiRequest(`/api/tasks/${state.editingTaskId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      showToast('Cập nhật công việc thành công!', 'success');
      cancelEditTask();
    } else {
      // Che do tao moi (POST)
      payload.status = 'todo';
      await apiRequest('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showToast('Thêm công việc mới thành công!', 'success');
      DOM.taskForm.reset();
    }

    await Promise.all([fetchStats(), fetchTasks()]);
  } catch (err) {
    // Loi da duoc thong bao
  }
});

// ==========================================
// 7. XOA TASK (MODAL XAC NHAN)
// ==========================================
function promptDeleteTask(task) {
  state.taskToDeleteId = task.id;
  DOM.confirmMessage.textContent = `Bạn có chắc muốn xóa công việc "${task.title}" không?`;
  DOM.modalConfirm.classList.remove('hidden');
}

function closeConfirmModal() {
  state.taskToDeleteId = null;
  DOM.modalConfirm.classList.add('hidden');
}

DOM.btnCloseConfirmModal.addEventListener('click', closeConfirmModal);
DOM.modalConfirmBackdrop.addEventListener('click', closeConfirmModal);
DOM.btnConfirmCancel.addEventListener('click', closeConfirmModal);

DOM.btnConfirmOk.addEventListener('click', async () => {
  if (!state.taskToDeleteId) return;
  const taskId = state.taskToDeleteId;
  closeConfirmModal();

  try {
    await apiRequest(`/api/tasks/${taskId}`, { method: 'DELETE' });
    showToast('Đã xóa công việc thành công', 'success');

    // Neu dang sua dung task vua xoa thi reset form
    if (state.editingTaskId === taskId) {
      cancelEditTask();
    }

    await Promise.all([fetchStats(), fetchTasks()]);
  } catch (err) {
    // Da xu ly loi
  }
});

// ==========================================
// 8. THEM NHOM & NGUOI DUNG MOI (MODAL)
// ==========================================
// Mo/dong Modal Nhom
DOM.btnOpenProjectModal.addEventListener('click', () => {
  DOM.modalProject.classList.remove('hidden');
  DOM.newProjectName.focus();
});
DOM.btnCloseProjectModal.addEventListener('click', () => DOM.modalProject.classList.add('hidden'));
DOM.modalProjectBackdrop.addEventListener('click', () => DOM.modalProject.classList.add('hidden'));

DOM.formNewProject.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = DOM.newProjectName.value.trim();
  const description = DOM.newProjectDesc.value.trim();

  if (!name) {
    showToast('Tên nhóm không được để trống', 'error');
    return;
  }

  try {
    await apiRequest('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
    showToast(`Đã thêm nhóm "${name}" thành công!`, 'success');
    DOM.formNewProject.reset();
    await fetchProjects();
  } catch (err) {
    // Da xu ly loi
  }
});

// Mo/dong Modal Nguoi dung
DOM.btnOpenUserModal.addEventListener('click', () => {
  DOM.modalUser.classList.remove('hidden');
  DOM.newUserName.focus();
});
DOM.btnCloseUserModal.addEventListener('click', () => DOM.modalUser.classList.add('hidden'));
DOM.modalUserBackdrop.addEventListener('click', () => DOM.modalUser.classList.add('hidden'));

DOM.formNewUser.addEventListener('submit', async (e) => {
  e.preventDefault();
  const full_name = DOM.newUserName.value.trim();
  const email = DOM.newUserEmail.value.trim();

  if (!full_name || !email) {
    showToast('Họ tên và email là bắt buộc', 'error');
    return;
  }

  try {
    await apiRequest('/api/users', {
      method: 'POST',
      body: JSON.stringify({ full_name, email }),
    });
    showToast(`Đã thêm người dùng "${full_name}" thành công!`, 'success');
    DOM.formNewUser.reset();
    await fetchUsers();
  } catch (err) {
    // Da xu ly loi
  }
});

// ==========================================
// 9. LOC & TIM KIEM
// ==========================================
let filterDebounceTimer = null;
DOM.filterQ.addEventListener('input', () => {
  clearTimeout(filterDebounceTimer);
  filterDebounceTimer = setTimeout(fetchTasks, 250);
});

DOM.filterStatus.addEventListener('change', fetchTasks);
DOM.filterProject.addEventListener('change', fetchTasks);
DOM.filterAssignee.addEventListener('change', fetchTasks);

DOM.btnResetFilters.addEventListener('click', () => {
  DOM.filterQ.value = '';
  DOM.filterStatus.value = '';
  DOM.filterProject.value = '';
  DOM.filterAssignee.value = '';
  fetchTasks();
});

DOM.btnRefresh.addEventListener('click', async () => {
  await reloadAll();
  showToast('Đã làm mới dữ liệu hệ thống!', 'info');
});

// ==========================================
// 10. KHOI DONG TRANG
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  reloadAll();
});
