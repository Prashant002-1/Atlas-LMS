"use client";

import { useState } from "react";

import { ActionButton } from "@/components/atlas/primitives";
import { courseMaterialFileAccept, FilePicker } from "@/components/teach/file-picker";
import { RecordDialog } from "@/components/teach/record-dialog";
import { addLinkedCourseMaterial, uploadCourseMaterial } from "@/lib/instructor/course-material-actions";
import type { CourseMaterialPlacementOptions } from "@/lib/instructor/course-material-options";

export function AddMaterialDialog({
  options,
  returnTo,
  defaultModuleId,
  triggerVariant = "primary",
}: {
  options: CourseMaterialPlacementOptions;
  returnTo: string;
  defaultModuleId?: string;
  triggerVariant?: "primary" | "secondary" | "quiet";
}) {
  const [source, setSource] = useState<"file" | "link">("file");
  const [fileName, setFileName] = useState("");
  const [moduleId, setModuleId] = useState(defaultModuleId ?? "");
  const [assignmentId, setAssignmentId] = useState("");
  const hasPlacement = Boolean(moduleId || assignmentId);

  return (
    <RecordDialog
      mode="create"
      triggerLabel="Add material"
      title="Add material"
      triggerVariant={triggerVariant}
    >
      <div className="mb-5 grid grid-cols-2 rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-1">
        <SourceButton active={source === "file"} onClick={() => setSource("file")}>File</SourceButton>
        <SourceButton active={source === "link"} onClick={() => setSource("link")}>Web link</SourceButton>
      </div>

      {source === "file" ? (
        <form action={uploadCourseMaterial} className="grid gap-4">
          <input type="hidden" name="returnTo" value={returnTo} />
          <input type="hidden" name="moduleId" value={moduleId} />
          <input type="hidden" name="assignmentId" value={assignmentId} />

          <FilePicker
            name="file"
            required
            accept={courseMaterialFileAccept}
            onFilesChange={(files) => setFileName(files[0]?.name ?? "")}
          />

          <label className="grid gap-1.5 text-[0.75rem] font-medium">
            Display name <span className="font-normal text-[var(--color-faint)]">Optional</span>
            <input name="displayName" type="text" maxLength={240} className={fieldClass} />
          </label>

          <VisibilityField />
          <PlacementFields
            options={options}
            moduleId={moduleId}
            assignmentId={assignmentId}
            onModuleChange={setModuleId}
            onAssignmentChange={setAssignmentId}
          />

          <div className="flex justify-end pt-2">
            <ActionButton disabled={!fileName || !hasPlacement}>Add material</ActionButton>
          </div>
        </form>
      ) : (
        <form action={addLinkedCourseMaterial} className="grid gap-4">
          <input type="hidden" name="returnTo" value={returnTo} />
          <input type="hidden" name="moduleId" value={moduleId} />
          <input type="hidden" name="assignmentId" value={assignmentId} />

          <label className="grid gap-1.5 text-[0.75rem] font-medium">
            Name
            <input name="displayName" type="text" required maxLength={240} className={fieldClass} />
          </label>
          <label className="grid gap-1.5 text-[0.75rem] font-medium">
            URL
            <input name="sourceUrl" type="url" required maxLength={2000} placeholder="https://" className={fieldClass} />
          </label>

          <VisibilityField />
          <PlacementFields
            options={options}
            moduleId={moduleId}
            assignmentId={assignmentId}
            onModuleChange={setModuleId}
            onAssignmentChange={setAssignmentId}
          />

          <div className="flex justify-end pt-2">
            <ActionButton disabled={!hasPlacement}>Add link</ActionButton>
          </div>
        </form>
      )}
    </RecordDialog>
  );
}

function SourceButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-9 rounded-control text-[0.8125rem] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-strong)] ${
        active
          ? "bg-[var(--color-surface)] text-[var(--color-ink)] shadow-[var(--shadow-panel)]"
          : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      }`}
    >
      {children}
    </button>
  );
}

function PlacementFields({
  options,
  moduleId,
  assignmentId,
  onModuleChange,
  onAssignmentChange,
}: {
  options: CourseMaterialPlacementOptions;
  moduleId: string;
  assignmentId: string;
  onModuleChange: (value: string) => void;
  onAssignmentChange: (value: string) => void;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-[0.75rem] font-medium text-[var(--color-ink)]">Attach to</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-[0.75rem] font-medium">
          Module
          <select value={moduleId} onChange={(event) => onModuleChange(event.currentTarget.value)} className={fieldClass}>
            <option value="">Not attached</option>
            {options.modules.map((module) => <option key={module.id} value={module.id}>{module.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-[0.75rem] font-medium">
          Assignment
          <select value={assignmentId} onChange={(event) => onAssignmentChange(event.currentTarget.value)} className={fieldClass}>
            <option value="">Not attached</option>
            {options.assignments.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.label}</option>)}
          </select>
        </label>
      </div>
    </fieldset>
  );
}

function VisibilityField() {
  return (
    <label className="grid gap-1.5 text-[0.75rem] font-medium">
      Access
      <select name="visibility" defaultValue="course" className={fieldClass}>
        <option value="course">Course</option>
        <option value="instructors">Instructors only</option>
      </select>
    </label>
  );
}

const fieldClass = "min-h-10 rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[0.8125rem] text-[var(--color-ink)] outline-none transition placeholder:text-[var(--color-faint)] focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]";
