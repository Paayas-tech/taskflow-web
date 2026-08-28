import {
  dateOnlyKey,
  normalizeTaskDocument,
  sortTasksNewestFirst,
} from "../domain/taskDomain";
import { taskRepository } from "../infrastructure/supabase/taskRepository";
import { projectRepository } from "../infrastructure/supabase/projectRepository";
import { createTaskService } from "./taskService";
import { sortAssignedTasksForAttention } from "../domain/assignmentDomain";

const normalizeProjectStatus = (status) =>
  String(status || "").trim().toLowerCase() === "archived"
    ? "archived"
    : "active";

const invitationRoles = new Set(["editor", "viewer"]);
const normalizeInvitationRole = (role) => {
  const normalized = String(role || "").trim().toLowerCase();
  if (!invitationRoles.has(normalized)) {
    throw new Error("Choose either Editor or Viewer access.");
  }
  return normalized;
};

const normalizeInvitationEmail = (email) => {
  const normalized = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Enter a valid email address.");
  }
  return normalized;
};

const taskAssignmentFromRow = (row = {}) => {
  const relationship = row.task_assignments;
  return Array.isArray(relationship) ? relationship[0] || null : relationship || null;
};

const createScopedTaskService = (repository, placementRepository, projectId) =>
  createTaskService({
    getPersonalTasks: (userId) => repository.getProjectTasks(userId, projectId),
    getPersonalTask: (userId, taskId) =>
      repository.getProjectTask(userId, projectId, taskId),
    createPersonalTask: (userId, values) =>
      repository.createProjectTask(userId, projectId, values),
    updatePersonalTask: (userId, taskId, values) =>
      repository.updateProjectTask(userId, projectId, taskId, values),
    deletePersonalTask: (userId, taskId) =>
      repository.deleteProjectTask(userId, projectId, taskId),
    // Project scope takes precedence over personal-list placement. The shared
    // task service still calls this hook during create/update, so always clear
    // any placement instead of forwarding a personal list id.
    setTaskList: (userId, taskId) =>
      placementRepository.setTaskList(userId, taskId, null),
    // The project service performs cross-scope relocation after the ordinary
    // task patch succeeds, so the shared task service must not relocate here.
    relocatePersonalTask: () => Promise.resolve(),
  });

export const createProjectService = (
  repository = projectRepository,
  placementRepository = taskRepository
) => ({
  getVisibleUserProfiles: (userIds) =>
    repository.getVisibleUserProfiles(userIds),
  getProjects: (userId) => repository.getProjects(userId),
  getProject: (userId, projectId) => repository.getProject(userId, projectId),
  getProjectColumns: (userId, projectId) =>
    repository.ensureDefaultColumns(userId, projectId),
  getProjectMembers: (userId, projectId) =>
    repository.getProjectMembers(userId, projectId),
  getProjectInvitations: (userId, projectId) =>
    repository.getProjectInvitations(userId, projectId),
  getUserInvitations: (userId, email) =>
    repository.getUserInvitations(userId, normalizeInvitationEmail(email)),

  async createProject(userId, projectData = {}) {
    const name = String(projectData.name || "").trim();
    if (!name) throw new Error("Project name cannot be empty.");
    const description = String(projectData.description || "");
    if (description.length > 1000) {
      throw new Error("Project descriptions must be 1,000 characters or fewer.");
    }

    return repository.createProject(userId, {
      name,
      description,
      color: String(projectData.color || ""),
      status: "active",
      due_date: projectData.dueDate || null,
      archived_at: null,
    });
  },

  async updateProject(userId, projectId, data = {}) {
    const patch = {};
    if (Object.prototype.hasOwnProperty.call(data, "name")) {
      patch.name = String(data.name || "").trim();
      if (!patch.name) throw new Error("Project name cannot be empty.");
    }
    if (Object.prototype.hasOwnProperty.call(data, "description")) {
      patch.description = String(data.description || "");
      if (patch.description.length > 1000) {
        throw new Error("Project descriptions must be 1,000 characters or fewer.");
      }
    }
    if (Object.prototype.hasOwnProperty.call(data, "color")) {
      patch.color = String(data.color || "");
    }
    if (Object.prototype.hasOwnProperty.call(data, "dueDate")) {
      patch.due_date = data.dueDate || null;
    }
    if (Object.prototype.hasOwnProperty.call(data, "status")) {
      patch.status = normalizeProjectStatus(data.status);
      patch.archived_at = patch.status === "archived" ? new Date().toISOString() : null;
    }
    return repository.updateProject(userId, projectId, patch);
  },

  deleteProject: (userId, projectId) =>
    repository.deleteProject(userId, projectId),

  async createProjectInvitation(userId, projectId, invitation = {}) {
    return repository.createProjectInvitation(userId, projectId, {
      email: normalizeInvitationEmail(invitation.email),
      role: normalizeInvitationRole(invitation.role),
      projectName: String(invitation.projectName || "").trim(),
    });
  },

  acceptProjectInvitation(userId, invitationId) {
    return repository.respondToInvitation(userId, invitationId, "accepted");
  },

  declineProjectInvitation(userId, invitationId) {
    return repository.respondToInvitation(userId, invitationId, "declined");
  },

  cancelProjectInvitation(userId, projectId, invitationId) {
    return repository.cancelProjectInvitation(userId, projectId, invitationId);
  },

  updateProjectMemberRole(userId, projectId, memberId, role) {
    if (memberId === userId) {
      throw new Error("Project ownership cannot be changed.");
    }
    return repository.updateProjectMemberRole(
      userId,
      projectId,
      memberId,
      normalizeInvitationRole(role)
    );
  },

  removeProjectMember(userId, projectId, memberId) {
    if (memberId === userId) {
      throw new Error("The project owner cannot remove themselves.");
    }
    return repository.removeProjectMember(userId, projectId, memberId);
  },

  async getProjectTasks(userId, projectId) {
    const rows = await repository.getProjectTasks(userId, projectId);
    return sortTasksNewestFirst(
      rows.map((row) => {
        const assignment = taskAssignmentFromRow(row);
        return {
          ...normalizeTaskDocument(row.id, repository.taskRowToDocument(row)),
          assigneeId: assignment?.user_id || null,
          assigneeName: row.assignee_display_name || "",
          columnId: row.column_id || null,
          position: Number.isFinite(row.position) ? row.position : null,
          version: Number.isFinite(row.version) ? row.version : 1,
        };
      })
    );
  },

  async getAssignedProjectTasks(userId, now = new Date()) {
    const rows = await repository.getAssignedProjectTasks(userId);
    const assignments = rows.map((row) => {
      const assignment = taskAssignmentFromRow(row);
      return {
        ...normalizeTaskDocument(row.id, repository.taskRowToDocument(row)),
        assigneeId: assignment?.user_id || userId,
        assigneeName: row.assignee_display_name || "",
        assignedAt: assignment?.assigned_at || null,
        projectName: row.projects?.name || "Untitled project",
        projectStatus: row.projects?.status || "active",
        columnId: row.column_id || null,
      };
    });
    return sortAssignedTasksForAttention(assignments, dateOnlyKey(now));
  },

  createProjectTask(userId, projectId, taskData) {
    return createScopedTaskService(repository, placementRepository, projectId).createTask(userId, {
      ...taskData,
      projectId,
    });
  },

  async updateProjectTask(userId, projectId, taskId, data) {
    await createScopedTaskService(repository, placementRepository, projectId).updateTask(
      userId,
      taskId,
      data
    );
    if (
      Object.prototype.hasOwnProperty.call(data, "projectId") &&
      (data.projectId || null) !== projectId
    ) {
      await repository.relocateProjectTask(
        userId,
        projectId,
        taskId,
        data.projectId || null
      );
    }
  },

  archiveProjectTask(userId, projectId, taskId) {
    return createScopedTaskService(repository, placementRepository, projectId).archiveTask(userId, taskId);
  },

  deleteProjectTask(userId, projectId, taskId) {
    return repository.deleteProjectTask(userId, projectId, taskId);
  },

  moveProjectTask(userId, projectId, taskId, columnId, position) {
    return repository.moveProjectTask(userId, projectId, taskId, columnId, position);
  },

  reorderProjectTasks(userId, projectId, placements) {
    return repository.reorderProjectTasks(userId, projectId, placements);
  },

  async setTaskAssignee(userId, projectId, taskId, assigneeId) {
    const normalizedAssignee = String(assigneeId || "").trim() || null;
    await repository.setTaskAssignee(
      userId,
      projectId,
      taskId,
      normalizedAssignee
    );
    return normalizedAssignee;
  },

  getTaskComments: (userId, taskId) =>
    repository.getTaskComments(userId, taskId),

  async createTaskComment(userId, taskId, content) {
    const normalized = String(content || "").trim();
    if (!normalized) throw new Error("Write a comment before posting.");
    if (normalized.length > 4000) {
      throw new Error("Comments must be 4,000 characters or fewer.");
    }
    return repository.createTaskComment(userId, taskId, normalized);
  },

  async updateTaskComment(userId, commentId, content) {
    const normalized = String(content || "").trim();
    if (!normalized) throw new Error("A comment cannot be empty.");
    if (normalized.length > 4000) {
      throw new Error("Comments must be 4,000 characters or fewer.");
    }
    return repository.updateTaskComment(userId, commentId, normalized);
  },

  deleteTaskComment: (userId, commentId) =>
    repository.deleteTaskComment(userId, commentId),

  getProjectActivity: (userId, projectId, limit) =>
    repository.getProjectActivity(userId, projectId, limit),

  getTaskActivity: (userId, taskId, limit) =>
    repository.getTaskActivity(userId, taskId, limit),

  subscribeToTaskComments: (taskId, onChange, onStatus) =>
    repository.subscribeToTaskComments(taskId, onChange, onStatus),

  subscribeToProjectActivity: (projectId, onChange, onStatus) =>
    repository.subscribeToProjectActivity(projectId, onChange, onStatus),
  subscribeToTaskActivity: (taskId, onChange, onStatus) =>
    repository.subscribeToTaskActivity(taskId, onChange, onStatus),
});

const supabaseProjectService = createProjectService();

export const getProjects = (...args) => supabaseProjectService.getProjects(...args);
export const getVisibleUserProfiles = (...args) =>
  supabaseProjectService.getVisibleUserProfiles(...args);
export const getProject = (...args) => supabaseProjectService.getProject(...args);
export const getProjectColumns = (...args) =>
  supabaseProjectService.getProjectColumns(...args);
export const getProjectMembers = (...args) =>
  supabaseProjectService.getProjectMembers(...args);
export const getProjectInvitations = (...args) =>
  supabaseProjectService.getProjectInvitations(...args);
export const getUserInvitations = (...args) =>
  supabaseProjectService.getUserInvitations(...args);
export const createProject = (...args) => supabaseProjectService.createProject(...args);
export const updateProject = (...args) => supabaseProjectService.updateProject(...args);
export const deleteProject = (...args) => supabaseProjectService.deleteProject(...args);
export const createProjectInvitation = (...args) =>
  supabaseProjectService.createProjectInvitation(...args);
export const acceptProjectInvitation = (...args) =>
  supabaseProjectService.acceptProjectInvitation(...args);
export const declineProjectInvitation = (...args) =>
  supabaseProjectService.declineProjectInvitation(...args);
export const cancelProjectInvitation = (...args) =>
  supabaseProjectService.cancelProjectInvitation(...args);
export const updateProjectMemberRole = (...args) =>
  supabaseProjectService.updateProjectMemberRole(...args);
export const removeProjectMember = (...args) =>
  supabaseProjectService.removeProjectMember(...args);
export const getProjectTasks = (...args) => supabaseProjectService.getProjectTasks(...args);
export const getAssignedProjectTasks = (...args) =>
  supabaseProjectService.getAssignedProjectTasks(...args);
export const createProjectTask = (...args) => supabaseProjectService.createProjectTask(...args);
export const updateProjectTask = (...args) => supabaseProjectService.updateProjectTask(...args);
export const archiveProjectTask = (...args) => supabaseProjectService.archiveProjectTask(...args);
export const deleteProjectTask = (...args) => supabaseProjectService.deleteProjectTask(...args);
export const moveProjectTask = (...args) => supabaseProjectService.moveProjectTask(...args);
export const reorderProjectTasks = (...args) =>
  supabaseProjectService.reorderProjectTasks(...args);
export const setTaskAssignee = (...args) =>
  supabaseProjectService.setTaskAssignee(...args);
export const getTaskComments = (...args) =>
  supabaseProjectService.getTaskComments(...args);
export const createTaskComment = (...args) =>
  supabaseProjectService.createTaskComment(...args);
export const updateTaskComment = (...args) =>
  supabaseProjectService.updateTaskComment(...args);
export const deleteTaskComment = (...args) =>
  supabaseProjectService.deleteTaskComment(...args);
export const getProjectActivity = (...args) =>
  supabaseProjectService.getProjectActivity(...args);
export const getTaskActivity = (...args) =>
  supabaseProjectService.getTaskActivity(...args);
export const subscribeToTaskComments = (...args) =>
  supabaseProjectService.subscribeToTaskComments(...args);
export const subscribeToProjectActivity = (...args) =>
  supabaseProjectService.subscribeToProjectActivity(...args);
export const subscribeToTaskActivity = (...args) =>
  supabaseProjectService.subscribeToTaskActivity(...args);
