import { cvDataClient } from "@site/data-access-core";
import { describe, expect, it } from "vitest";
import { buildCourseDetails } from "./index";

describe("course shaping", () => {
  it("builds optional detail metadata", () => {
    const course = cvDataClient.domain("courses")[0];
    expect(course).toBeDefined();
    if (!course) return;
    const details = buildCourseDetails(course);
    expect(details.hasDetails).toBe(
      Boolean(
        course.long_description ||
          course.textbook ||
          course.prerequisites ||
          course.grading ||
          course.resources?.length,
      ),
    );
    expect(details.gradingCategories).toEqual(
      Object.entries(course.grading?.categories ?? {}),
    );
    expect(buildCourseDetails({ id: "sparse", title: "Sparse" })).toEqual({
      gradeScale: [],
      gradingCategories: [],
      hasDetails: false,
    });
    for (const item of cvDataClient.domain("courses")) {
      expect(buildCourseDetails(item).hasDetails).toBe(
        Boolean(
          item.long_description ||
            item.textbook ||
            item.prerequisites ||
            item.grading ||
            item.resources?.length,
        ),
      );
    }
  });
});
