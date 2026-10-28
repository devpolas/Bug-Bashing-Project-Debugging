// authentication service

const bcrypt = require("bcrypt");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const { sendWelcomeEmail } = require("./email.service");

const createError = (message, statusCode) =>
  Object.assign(new Error(message), { statusCode });

const register = async ({ name, email, password, adminKey }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const exists = await User.findOne({ email: normalizedEmail });
  if (exists) throw createError("Email already registered", 409);

  let role = "student";
  if (adminKey) {
    if (
      !process.env.ADMIN_REGISTRATION_KEY ||
      adminKey !== process.env.ADMIN_REGISTRATION_KEY
    ) {
      throw createError("Invalid admin registration key", 403);
    }
    role = "admin";
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Public registration always creates students; admin creation requires the server-side key.
  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    role,
  });

  const token = generateToken({ id: user._id, role: user.role });

  // Send welcome email (non-blocking - don't wait for it)
  sendWelcomeEmail(user.email, user.name).catch((err) => {
    console.error("Email sending failed (non-critical):", err.message);
  });

  return {
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  };
};

const login = async ({ email, password }) => {
  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (!user) throw createError("Invalid email or password", 401);

  if (user.isBanned) throw createError("This account has been disabled", 403);

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) throw createError("Invalid email or password", 401);

  const token = generateToken({ id: user._id, role: user.role });

  return {
    token,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  };
};

const getMe = async (userId) => {
  const user = await User.findById(userId).select("-passwordHash");
  if (!user) throw new Error("User not found");
  return user;
};

module.exports = { register, login, getMe };
