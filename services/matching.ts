import { AcademicLevel } from "@/types/types";

export const calculateMatchScore = (me: any, other: any): number => {
  if (!me || !other) return 0;

  let score = 0;

  // Subjects overlap
  if (me.subjects && other.subjects) {
    const common = me.subjects.filter((s: string) => other.subjects.includes(s));
    score += common.length * 10;
  }

  // Study methods overlap
  if (me.methods && other.methods) {
    const common = me.methods.filter((m: string) => other.methods.includes(m));
    score += common.length * 5;
  }

  // Availability overlap
  if (me.preferences && other.preferences) {
    const common = me.preferences.filter((p: string) => other.preferences.includes(p));
    score += common.length * 3;
  }

  // Academic level match
  if (me.academicLevel && me.academicLevel === other.academicLevel) {
    score += 8;
  }

  return score;
};
