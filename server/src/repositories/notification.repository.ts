import type { CrmLane, Role } from "@speego/shared";

export interface NotificationRecord {
  id: string;
  recipientId: string;
  actorId: string | null;
  type: string;
  title: string;
  body: string;
  href: string;
  lane: CrmLane | null;
  refType: string | null;
  refId: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationDraft {
  type: string;
  title: string;
  body: string;
  href: string;
  lane?: CrmLane | null;
  refType?: string | null;
  refId?: string | null;
  actorId?: string | null;
}

export interface NotificationRepository {
  listForUser(userId: string, limit?: number): Promise<NotificationRecord[]>;
  unreadCount(userId: string): Promise<number>;
  markRead(userId: string, id: string): Promise<boolean>;
  markAllRead(userId: string): Promise<number>;
  listUserIdsByRoles(roles: readonly Role[]): Promise<string[]>;
  createMany(recipientIds: readonly string[], draft: NotificationDraft): Promise<number>;
}
