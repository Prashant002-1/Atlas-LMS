import { ActionButton } from "@/components/atlas/primitives";
import { documentFileAccept, FilePicker } from "@/components/teach/file-picker";
import { RecordDialog } from "@/components/teach/record-dialog";
import { RichTextEditor } from "@/components/teach/rich-text-editor";
import { createAssignmentRecord } from "@/lib/instructor/actions";
import type { CourseMaterialPlacementOption } from "@/lib/instructor/course-material-options";
import { MAX_COURSE_MATERIAL_BYTES } from "@/lib/course/materials";

export function NewAssignmentDialog({
  modules,
  defaultModuleId,
  defaultOpen = false,
  triggerVariant = "primary",
}: {
  modules: CourseMaterialPlacementOption[];
  defaultModuleId?: string;
  defaultOpen?: boolean;
  triggerVariant?: "primary" | "secondary" | "quiet";
}) {
  return (
    <RecordDialog
      mode="create"
      triggerLabel="New assignment"
      title="New assignment"
      triggerVariant={triggerVariant}
      defaultOpen={defaultOpen}
      wide
    >
      <form action={createAssignmentRecord} className="grid gap-4">
        <label className="grid gap-1.5 text-[0.75rem] font-medium">
          Title
          <input name="title" type="text" required autoFocus maxLength={220} placeholder="Problem Set 6: Regression diagnostics" className={fieldClass} />
        </label>

        <RichTextEditor name="description" label="Instructions" rows={8} maxLength={1600} />

        <label className="grid gap-1.5 text-[0.75rem] font-medium">
          Module / week <span className="font-normal text-[var(--color-faint)]">Optional</span>
          <select name="moduleId" defaultValue={defaultModuleId ?? ""} className={fieldClass}>
            <option value="">Use due date</option>
            {modules.map((module) => <option key={module.id} value={module.id}>{module.label}</option>)}
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-[0.75rem] font-medium">
            Due
            <input name="dueDate" type="date" className={fieldClass} />
          </label>
          <label className="grid gap-1.5 text-[0.75rem] font-medium">
            Points
            <input name="points" type="number" min={1} defaultValue={100} className={fieldClass} />
          </label>
        </div>

        <fieldset className="grid gap-1.5">
          <legend className="text-[0.75rem] font-medium text-[var(--color-ink)]">
            Documents <span className="font-normal text-[var(--color-faint)]">Optional</span>
          </legend>
          <FilePicker
            name="documents"
            label="Choose documents"
            accept={documentFileAccept}
            multiple
            maxFiles={10}
            maxTotalBytes={MAX_COURSE_MATERIAL_BYTES}
          />
        </fieldset>

        <div className="flex justify-end pt-4">
          <ActionButton>Create assignment</ActionButton>
        </div>
      </form>
    </RecordDialog>
  );
}

const fieldClass = "min-h-10 rounded-control border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-[0.8125rem] text-[var(--color-ink)] outline-none transition placeholder:text-[var(--color-faint)] focus:border-[var(--color-accent-strong)] focus:bg-[var(--color-surface)]";
