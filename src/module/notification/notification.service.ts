import prisma from "../../lib/prisma.js";

export type NotificationDto = {
  id: string;
  title: string;
  body: string;
  createdBy: string;
  authorName: string;
  createdAt: string;
};

export type TeacherNotificationDto = NotificationDto & {
  read: boolean;
};

export async function createNotification(
  createdBy: string,
  title: string,
  body: string,
): Promise<NotificationDto> {
  const notification = await prisma.notification.create({
    data: {
      title,
      body,
      createdBy,
    },
    include: {
      author: true,
    },
  });

  return toNotificationDto(notification);
}

export async function listNotifications(): Promise<NotificationDto[]> {
  const notifications = await prisma.notification.findMany({
    include: { author: true },
    orderBy: { createdAt: "desc" },
  });

  return notifications.map(toNotificationDto);
}

export async function listNotificationsForUser(
  userId: string,
): Promise<TeacherNotificationDto[]> {
  const notifications = await prisma.notification.findMany({
    include: {
      author: true,
      reads: {
        where: { userId },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return notifications.map((notification) => ({
    ...toNotificationDto(notification),
    read: notification.reads.length > 0,
  }));
}

export async function markNotificationRead(
  userId: string,
  notificationId: string,
): Promise<void> {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new NotificationError("Notification not found", 404);
  }

  await prisma.notificationRead.upsert({
    where: {
      notificationId_userId: {
        notificationId,
        userId,
      },
    },
    create: {
      notificationId,
      userId,
    },
    update: {},
  });
}

function toNotificationDto(notification: {
  id: string;
  title: string;
  body: string;
  createdBy: string;
  createdAt: Date;
  author: { name: string };
}): NotificationDto {
  return {
    id: notification.id,
    title: notification.title,
    body: notification.body,
    createdBy: notification.createdBy,
    authorName: notification.author.name,
    createdAt: notification.createdAt.toISOString(),
  };
}

export class NotificationError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "NotificationError";
  }
}
