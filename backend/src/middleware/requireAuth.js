import jwt from "jsonwebtoken";
import User from "../schema/userSchema.js";

export const protectRoute = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;

    if (!token) { // unauthorized access
      return res.status(401).json({ message: "You're not logged in. Please log in to continue" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded) { // Verify token and decode user ID
      return res.status(401).json({ message: "Your session has expired, Please log in again" });
    }

    const isTaken = await User.findById(decoded.userId).select("-password");

    if (!isTaken) {
      return res.status(404).json({ message: "We couldn't find your account. Please sign up again" });
    }

    req.user = isTaken;

    next();
  } catch (error) {
    console.log("Error in protectRoute middleware: ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
