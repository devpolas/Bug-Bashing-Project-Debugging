const Enrollment = require("../models/Enrollment");
const Course = require("../models/Course");

const enrollCourse = async (studentId, courseId, batchId = null) => {
  const course = await Course.findById(courseId);
  if (!course) throw new Error("Course not found");

  const existingEnrollment = await Enrollment.findOne({
    student: studentId,
    course: courseId,
  });
  if (existingEnrollment) {
    throw new Error("Already enrolled in this course");
  }

  if (batchId) {
    const batchExists = course.batches?.some(
      (batch) => String(batch._id) === String(batchId),
    );
    if (!batchExists)
      throw new Error("Selected batch does not belong to this course");
  }

  return Enrollment.create({
    student: studentId,
    course: courseId,
    batchId: batchId || undefined,
    progress: { completedLessons: [], percent: 0 },
  });
};

const getMyEnrollments = async (studentId) => {
  return Enrollment.find({ student: studentId })
    .populate("course", "title instructorName price category tags")
    .sort({ createdAt: -1 });
};

const completeLesson = async (studentId, enrollId, lessonId) => {
  const enrollment = await Enrollment.findById(enrollId);
  if (!enrollment) throw new Error("Enrollment not found");
  if (String(enrollment.student) !== String(studentId)) {
    const error = new Error("You are not allowed to update this enrollment");
    error.statusCode = 403;
    throw error;
  }

  const course = await Course.findById(enrollment.course);
  if (!course) throw new Error("Course not found");

  const lessonExists = course.syllabus?.some((module) =>
    module.lessons?.some((lesson) => String(lesson._id) === String(lessonId)),
  );
  if (!lessonExists) throw new Error("Lesson not found");

  if (!enrollment.progress) {
    enrollment.progress = { completedLessons: [], percent: 0 };
  }
  if (!Array.isArray(enrollment.progress.completedLessons)) {
    enrollment.progress.completedLessons = [];
  }

  const alreadyDone = enrollment.progress.completedLessons.some(
    (completedId) => String(completedId) === String(lessonId),
  );
  if (!alreadyDone) {
    enrollment.progress.completedLessons.push(lessonId);
  }

  const totalLessons = (course.syllabus || []).reduce(
    (sum, module) => sum + (module.lessons?.length || 0),
    0,
  );
  const completed = enrollment.progress.completedLessons.length;
  enrollment.progress.percent =
    totalLessons === 0
      ? 0
      : Math.min(100, Math.round((completed / totalLessons) * 100));

  await enrollment.save();
  return enrollment;
};

module.exports = { enrollCourse, getMyEnrollments, completeLesson };
