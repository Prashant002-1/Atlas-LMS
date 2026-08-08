import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { files, moduleItems, modules, pages } from "@/lib/db/schema";
import { courseMaterialRecords } from "@/lib/db/course-agent-schema";

/**
 * What is actually inside a module.
 *
 * A module is the week, so its page has to hold the week: the readings, the
 * handouts, the slides, and the assignments. The detail page showed only a
 * brief and a list of assignments, which described a syllabus row rather than a
 * week of a real course.
 *
 * Contents come from three places, in the order a professor thinks about them:
 * items explicitly placed in the module, then course pages aligned to the same
 * objectives, then files that landed in the module's own date window. That last
 * rule is a heuristic and is labeled as such in the UI, because a file uploaded
 * during week three is usually week three's material but is not a promise.
 */

export type ModuleContentKind = "page" | "document" | "slides" | "assignment" | "quiz" | "link";

export type ModuleContentItem = {
  id: string;
  kind: ModuleContentKind;
  title: string;
  detail: string | null;
  href: string | null;
  published: boolean;
  /** Why this item is here, when it was inferred rather than placed. */
  inferred?: boolean;
};

export type ModuleContents = {
  items: ModuleContentItem[];
  documents: ModuleContentItem[];
  pages: ModuleContentItem[];
};

export async function loadModuleContents(args: {
  orgId: string;
  courseId: string;
  moduleId: string;
  /** Objectives the module carries, used to find aligned pages. */
  pageSlugsByObjective?: string[];
}): Promise<ModuleContents> {
  const [row] = await db
    .select({ id: modules.id, unlockAt: modules.unlockAt, position: modules.position })
    .from(modules)
    .where(and(eq(modules.orgId, args.orgId), eq(modules.courseId, args.courseId), eq(modules.id, args.moduleId)))
    .limit(1);
  if (!row) return { items: [], documents: [], pages: [] };

  /* Items explicitly placed in this module. */
  const placedRows = await db
    .select({
      id: moduleItems.id,
      title: moduleItems.title,
      type: moduleItems.type,
      contentId: moduleItems.contentId,
      published: moduleItems.published,
      position: moduleItems.position,
      fileUrl: files.url,
    })
    .from(moduleItems)
    .leftJoin(
      files,
      and(
        eq(files.id, moduleItems.contentId),
        eq(files.orgId, args.orgId),
        eq(files.courseId, args.courseId)
      )
    )
    .where(
      and(
        eq(moduleItems.orgId, args.orgId),
        eq(moduleItems.courseId, args.courseId),
        eq(moduleItems.moduleId, args.moduleId)
      )
    )
    .orderBy(asc(moduleItems.position));

  const placed: ModuleContentItem[] = placedRows.map((item) => ({
    id: item.id,
    kind: normalizeKind(item.type),
    title: item.title,
    detail: null,
    href: hrefForPlacedItem(item.type, item.contentId, item.fileUrl),
    published: item.published,
  }));
  const explicitlyPlacedFileIds = new Set(
    placedRows
      .filter((item) => ["file", "externalurl", "link"].includes(item.type.toLowerCase()))
      .map((item) => item.contentId)
      .filter((value): value is string => Boolean(value))
  );

  /*
   * Course pages that serve this module's objectives. Alignment is the
   * relationship the course already records, so this needs no new data.
   */
  const slugs = args.pageSlugsByObjective ?? [];
  const pageRows = slugs.length
    ? await db
        .select({ id: pages.id, title: pages.title, slug: pages.slug, published: pages.published })
        .from(pages)
        .where(and(eq(pages.orgId, args.orgId), eq(pages.courseId, args.courseId)))
        .orderBy(asc(pages.title))
    : [];
  const pageItems: ModuleContentItem[] = pageRows
    .filter((page) => slugs.includes(page.slug))
    .map((page) => ({
      id: page.id,
      kind: "page" as const,
      title: page.title,
      detail: null,
      href: `/teach/records/${page.id}`,
      published: page.published,
    }));

  /*
   * Files that arrived inside this module's week. Only used when the module has
   * a date, and marked inferred so the UI never claims the professor filed it
   * here deliberately.
   */
  let documents: ModuleContentItem[] = [];
  if (row.unlockAt) {
    const windowStart = row.unlockAt;
    const windowEnd = new Date(windowStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const fileRows = await db
      .select({
        id: files.id,
        displayName: files.displayName,
        filename: files.filename,
        contentType: files.contentType,
        createdAt: files.createdAt,
        materialKind: courseMaterialRecords.materialKind,
        visibility: courseMaterialRecords.visibility,
        processingStatus: courseMaterialRecords.processingStatus,
      })
      .from(files)
      .leftJoin(
        courseMaterialRecords,
        and(
          eq(courseMaterialRecords.fileId, files.id),
          eq(courseMaterialRecords.orgId, args.orgId),
          eq(courseMaterialRecords.courseId, args.courseId)
        )
      )
      .where(
        and(
          eq(files.orgId, args.orgId),
          eq(files.courseId, args.courseId),
          gte(files.createdAt, windowStart),
          lt(files.createdAt, windowEnd)
        )
      )
      .orderBy(asc(files.displayName));

    documents = fileRows.filter((file) => !explicitlyPlacedFileIds.has(file.id)).map((file) => ({
      id: file.id,
      kind: file.materialKind === "slides" ? ("slides" as const) : ("document" as const),
      title: file.displayName,
      detail: [file.filename, file.processingStatus === "ready" ? null : "Processing"].filter(Boolean).join(" / ") || null,
      href: `/teach/documents/${file.id}`,
      published: file.visibility === "course",
      inferred: true,
    }));
  }

  return { items: placed, documents, pages: pageItems };
}

function normalizeKind(type: string): ModuleContentKind {
  const value = type.toLowerCase();
  if (value === "assignment") return "assignment";
  if (value === "page") return "page";
  if (value === "quiz") return "quiz";
  if (value === "file") return "document";
  if (value === "externalurl" || value === "link") return "link";
  return "document";
}

function hrefForPlacedItem(type: string, contentId: string | null, fileUrl: string | null): string | null {
  if (!contentId) return null;
  const kind = normalizeKind(type);
  if (kind === "assignment") return `/teach/assignments/${contentId}`;
  if (kind === "page" || kind === "quiz") return `/teach/records/${contentId}`;
  if (kind === "document" || kind === "slides") return `/teach/documents/${contentId}`;
  if (kind === "link") return safeExternalHref(fileUrl);
  return null;
}

function safeExternalHref(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.toString() : null;
  } catch {
    return null;
  }
}
