export interface AppNotification {
  id: string;
  recipientId: string;
  actorId: string | null;
  type: string;
  title: string;
  body: string;
  href: string;
  lane: "vn" | "global" | null;
  refType: string | null;
  refId: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}
