import type { Course } from "@site/data-access-core";

export interface CourseDetailsModel {
  gradingCategories: [string, number][];
  gradeScale: [string, { maximum: number; minimum: number }][];
  hasDetails: boolean;
}

export function buildCourseDetails(course: Course): CourseDetailsModel {
  return {
    gradingCategories: Object.entries(course.grading?.categories ?? {}),
    gradeScale: Object.entries(course.grading?.scale ?? {}),
    hasDetails: Boolean(
      course.long_description ||
        course.textbook ||
        course.prerequisites ||
        course.grading ||
        course.resources?.length,
    ),
  };
}
