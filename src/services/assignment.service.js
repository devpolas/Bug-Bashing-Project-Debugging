const AssignmentSubmission = require("../models/AssignmentSubmission");
const Enrollment = require("../models/Enrollment");
const Course = require("../models/Course");

const submitAssignment = async (studentId, payload) => {
  const { courseId, lessonId, answerType, answer } = payload;

  if (!["text", "link"].includes(answerType)) {
    throw new Error("answerType must be text or link");
  }
  if (typeof answer !== "string" || !answer.trim()) {
    throw new Error("An assignment answer is required");
  }
  if (answerType === "link") {
    try {
      const parsedUrl = new URL(answer.trim());
      if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error();
    } catch {
      throw new Error("Please provide a valid HTTP or HTTPS link");
    }
  }

  // Ensure the student is enrolled and the lesson belongs to the requested course.
  const enrolled = await Enrollment.findOne({
    student: studentId,
    course: courseId,
  });
  if (!enrolled) throw new Error("You are not enrolled in this course");

  const course = await Course.findById(courseId);
  if (!course) throw new Error("Course not found");
  const lesson = (course.syllabus || [])
    .flatMap((module) => module.lessons || [])
    .find((item) => String(item._id) === String(lessonId));
  if (!lesson) throw new Error("Lesson not found");
  if (!lesson.assignmentPrompt)
    throw new Error("This lesson has no assignment");

  const submission = await AssignmentSubmission.create({
    student: studentId,
    course: courseId,
    lessonId,
    answerType,
    answer: answer.trim(),
  });

  return submission;
};

const getMySubmissions = async (studentId, courseId = null) => {
  const filter = { student: studentId };
  if (courseId) filter.course = courseId;

  return AssignmentSubmission.find(filter)
    .populate("course", "title")
    .populate("reviewer", "name")
    .sort({ createdAt: -1 });
};

// Get assignment statistics for a course
const getAssignmentStats = async (studentId, courseId) => {
  const submissions = await AssignmentSubmission.find({
    student: studentId,
    course: courseId,
  })
    .populate("reviewer", "name")
    .sort({ createdAt: -1 });

  if (submissions.length === 0) {
    return {
      average: 0,
      totalAssignments: 0,
      reviewedCount: 0,
      submissions: [],
    };
  }

  // Calculate average from graded assignments only
  const gradedSubmissions = submissions.filter(
    (s) => s.grade !== null && s.grade !== undefined,
  );
  const average =
    gradedSubmissions.length > 0
      ? Math.round(
          gradedSubmissions.reduce((sum, s) => sum + s.grade, 0) /
            gradedSubmissions.length,
        )
      : 0;

  return {
    average,
    totalAssignments: submissions.length,
    reviewedCount: submissions.filter((s) => s.status === "reviewed").length,
    submissions: submissions.map((s) => ({
      _id: s._id,
      lessonId: s.lessonId,
      answer: s.answer,
      answerType: s.answerType,
      status: s.status,
      grade: s.grade,
      reviewNotes: s.reviewNotes,
      reviewer: s.reviewer,
      submittedAt: s.createdAt,
      reviewedAt: s.updatedAt,
    })),
  };
};

module.exports = { submitAssignment, getMySubmissions, getAssignmentStats };
