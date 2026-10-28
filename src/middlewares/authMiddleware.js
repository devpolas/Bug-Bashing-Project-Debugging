// Authenticate the JWT and load the current user so role changes and bans take effect immediately.
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) {
    return res.status(401).json({ message: "Not authorized" });
  }

  const token = header.startsWith("Bearer ")
    ? header.slice(7).trim()
    : header.trim();
  if (!token) {
    return res.status(401).json({ message: "Not authorized" });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  try {
    const user = await User.findById(decoded.id).select("role isBanned");
    if (!user) {
      return res.status(401).json({ message: "User no longer exists" });
    }
    if (user.isBanned) {
      return res
        .status(403)
        .json({ message: "This account has been disabled" });
    }

    req.user = { id: String(user._id), role: user.role };
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = authMiddleware;
