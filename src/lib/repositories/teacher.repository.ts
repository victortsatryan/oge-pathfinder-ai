import {
  teacherStudentSchema,
  type TeacherStudent,
} from "@/lib/models/schemas";
import { safeAwait, parseList } from "@/lib/query/parse";
import { listMyTeacherStudents } from "@/lib/teacher.functions";

/** Teacher domain repository. */
export const teacherRepo = {
  async students(): Promise<TeacherStudent[]> {
    const raw = await safeAwait("teacher.students", () => listMyTeacherStudents());
    return parseList("teacher.students", teacherStudentSchema, raw);
  },
};
