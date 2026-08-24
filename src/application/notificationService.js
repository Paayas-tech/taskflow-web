import { notificationRepository } from "../infrastructure/supabase/notificationRepository";

export const createNotificationService = (repository = notificationRepository) => ({
  getNotifications: (userId, limit) => repository.getNotifications(userId, limit),
  markNotificationRead: (userId, notificationId) =>
    repository.markNotificationRead(userId, notificationId),
  markAllNotificationsRead: (userId) =>
    repository.markAllNotificationsRead(userId),
  deleteNotification: (userId, notificationId) =>
    repository.deleteNotification(userId, notificationId),
  subscribeToNotifications: (userId, onChange, onStatus) =>
    repository.subscribeToNotifications(userId, onChange, onStatus),
});

const notificationService = createNotificationService();

export const getNotifications = (...args) =>
  notificationService.getNotifications(...args);
export const markNotificationRead = (...args) =>
  notificationService.markNotificationRead(...args);
export const markAllNotificationsRead = (...args) =>
  notificationService.markAllNotificationsRead(...args);
export const deleteNotification = (...args) =>
  notificationService.deleteNotification(...args);
export const subscribeToNotifications = (...args) =>
  notificationService.subscribeToNotifications(...args);
