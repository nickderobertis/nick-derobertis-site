import { useId } from "react";

/**
 * The two checkboxes that decide which halves of the CV the chart draws. Each
 * one is a labelled native checkbox, so the whole filter is reachable by
 * keyboard and announced by name without any extra wiring.
 */
export function TimelineFilters({
  education,
  employment,
  onEducationChange,
  onEmploymentChange,
}: {
  education: boolean;
  employment: boolean;
  onEducationChange: (checked: boolean) => void;
  onEmploymentChange: (checked: boolean) => void;
}) {
  const employmentId = useId();
  const educationId = useId();
  return (
    <fieldset className="timeline-filters">
      <legend>Filters:</legend>
      <label htmlFor={employmentId}>
        <input
          id={employmentId}
          type="checkbox"
          checked={employment}
          onChange={(event) => onEmploymentChange(event.currentTarget.checked)}
        />
        Employment
      </label>
      <label htmlFor={educationId}>
        <input
          id={educationId}
          type="checkbox"
          checked={education}
          onChange={(event) => onEducationChange(event.currentTarget.checked)}
        />
        Education
      </label>
    </fieldset>
  );
}
