"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isInstructorLike } from "@/lib/auth/session";
import {
  archiveProfessorChat,
  archiveStudentChat,
  restoreProfessorChat,
  restoreStudentChat,
} from "@/lib/agent/chat-archive";

const chatIdSchema = z.string().uuid();

function chatIdFrom(formData: FormData): string {
  return chatIdSchema.parse(String(formData.get("chatId") ?? ""));
}

function activeChatIdFrom(formData: FormData): string | null {
  const value = String(formData.get("activeChatId") ?? "");
  return chatIdSchema.safeParse(value).data ?? null;
}

export async function archiveProfessorAtlasChat(formData: FormData) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.orgId || !isInstructorLike(user.role)) throw new Error("Atlas chat unavailable.");
  const archived = await archiveProfessorChat({ orgId: user.orgId, userId: user.id, chatId: chatIdFrom(formData) });
  if (!archived) throw new Error("This chat could not be archived while Atlas is working.");
  revalidatePath("/teach/atlas");
  revalidatePath("/teach/settings");
  redirect("/teach/atlas?thread=new");
}

export async function restoreProfessorAtlasChat(formData: FormData) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.orgId || !isInstructorLike(user.role)) throw new Error("Atlas chat unavailable.");
  const restored = await restoreProfessorChat({ orgId: user.orgId, userId: user.id, chatId: chatIdFrom(formData) });
  if (!restored) throw new Error("Archived chat unavailable.");
  revalidatePath("/teach/atlas");
  revalidatePath("/teach/settings");
}

export async function archiveProfessorAtlasChatFromList(formData: FormData) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.orgId || !isInstructorLike(user.role)) throw new Error("Atlas chat unavailable.");
  const chatId = chatIdFrom(formData);
  const archived = await archiveProfessorChat({ orgId: user.orgId, userId: user.id, chatId });
  if (!archived) throw new Error("This chat could not be archived while Atlas is working.");
  revalidatePath("/teach/atlas");
  revalidatePath("/teach/settings");
  if (activeChatIdFrom(formData) === chatId) redirect("/teach/atlas?thread=new");
}

export async function archiveStudentAtlasChat(formData: FormData) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.orgId || user.role !== "student") throw new Error("Atlas chat unavailable.");
  const archived = await archiveStudentChat({ orgId: user.orgId, studentId: user.id, chatId: chatIdFrom(formData) });
  if (!archived) throw new Error("This chat could not be archived while Atlas is working.");
  revalidatePath("/student/atlas");
  revalidatePath("/student/atlas/profile");
  redirect("/student/atlas?thread=new");
}

export async function restoreStudentAtlasChat(formData: FormData) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.orgId || user.role !== "student") throw new Error("Atlas chat unavailable.");
  const restored = await restoreStudentChat({ orgId: user.orgId, studentId: user.id, chatId: chatIdFrom(formData) });
  if (!restored) throw new Error("Archived chat unavailable.");
  revalidatePath("/student/atlas");
  revalidatePath("/student/atlas/profile");
}

export async function archiveStudentAtlasChatFromList(formData: FormData) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.orgId || user.role !== "student") throw new Error("Atlas chat unavailable.");
  const chatId = chatIdFrom(formData);
  const archived = await archiveStudentChat({ orgId: user.orgId, studentId: user.id, chatId });
  if (!archived) throw new Error("This chat could not be archived while Atlas is working.");
  revalidatePath("/student/atlas");
  revalidatePath("/student/atlas/profile");
  if (activeChatIdFrom(formData) === chatId) redirect("/student/atlas?thread=new");
}
