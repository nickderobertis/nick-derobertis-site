import { cvDataClient } from "@site/data-access-core";
import { describe, expect, it } from "vitest";
import {
  groupTimelineEntries,
  timelineFinalYear,
  timelineLabel,
  timelineOrganization,
  timelinePosition,
} from "./index";

describe("timeline shaping", () => {
  const timeline = cvDataClient.domain("timeline");

  it("groups entries and derives display values", () => {
    const groups = groupTimelineEntries(timeline);
    const entry = timeline[0];
    expect(groups.length).toBeGreaterThan(0);
    expect(entry).toBeDefined();
    if (!entry) return;
    expect(timelineLabel(entry)).toBeTruthy();
    expect(timelineLabel(entry, true)).toBeTruthy();
    expect(timelineOrganization(entry)).toBe(entry.organization);
    expect(timelineOrganization(entry, true)).toBeTruthy();
    expect(timelineFinalYear(timeline, 2030)).toBeGreaterThanOrEqual(2030);
    expect(timelinePosition(entry.start, 2030)).toBeGreaterThanOrEqual(0);
    expect(timelinePosition("1900-01-01", 2030)).toBe(0);
    expect(timelinePosition("2200-01-01", 2030)).toBe(100);
    for (const item of timeline) {
      expect(timelineLabel(item)).toBeTruthy();
      expect(timelineLabel(item, true)).toBeTruthy();
      expect(timelineOrganization(item, true)).toBeTruthy();
    }
    const employment = timeline.find((item) => "title" in item);
    const education = timeline.find((item) => "degree" in item);
    expect(employment).toBeDefined();
    expect(education).toBeDefined();
    if (employment) {
      expect(
        timelineLabel({ ...employment, title_short: undefined }, true),
      ).toBe(employment.title);
      expect(
        timelineOrganization(
          { ...employment, organization_short: undefined },
          true,
        ),
      ).toBe(employment.organization);
    }
    if (education) {
      expect(
        timelineLabel({ ...education, short_degree: undefined }, true),
      ).toBe(education.degree);
      expect(
        timelineOrganization(
          { ...education, organization: "Virginia Commonwealth University" },
          true,
        ),
      ).toBe("VCU");
      expect(
        timelineOrganization(
          { ...education, organization: "Another University" },
          true,
        ),
      ).toBe("Another University");
    }
    expect(groupTimelineEntries([])).toEqual([]);
    expect(timelineFinalYear([], 2030)).toBe(2030);
  });
});
