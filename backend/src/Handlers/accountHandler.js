import { generateToken } from "../lib/tools.js"; // set it in the cookie
import User from "../schema/userSchema.js";
import bcrypt from "bcryptjs"; // hashing and verifying passwords
import cloudinary from "../lib/cloudinary.js";

// Handles user account creation, including validation, hashing, and token issuance
export const signup = async (req, res) => {
  const { fullName, email, password } = req.body;

  try {
    // Check for missing fields
    const missingField = !fullName || !email || !password;
    if (missingField) {
      return res.status(400).json({ message: "Oops! Don't forget to complete all the fields" });
    }

    // Enforce minimum password length
    if (password.length < 8) {
      return res.status(400).json({ message: "Oops! Make sure your password has 8 or more character" });
    }

    // Validate strong passwords
    const validation = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
    const isStrong = validation.test(password);
    if (!isStrong) {
      return res.status(400).json({
        message: "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
      });
    }

    const user = await User.findOne({ email });
    if (user !== null) {
      return res.status(400).json({ message: "Looks like there's already an account with this email" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const newUser = new User({
      fullName,
      email,
      password: hashed,
    });

    if (!newUser) {
      return res.status(400).json({ message: "Invalid user data" });
    }

    // generate jwt 
    generateToken(newUser._id, res);
    await newUser.save();

    return res.status(201).json({
      _id: newUser._id,
      fullName: newUser.fullName,
      email: newUser.email,
      avatar: newUser.avatar,
    });

  } catch (error) {
    console.log("Signup failed:", error.message);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// logs in and returns a JWT token 
export const signIn = async (req, res) => {
  const { email, password } = req.body;

  try {
    // check if user exist
    const user = await User.findOne({ email });
    if (user == null) {
      return res.status(400).json({ message: "Hmm... that email doesn't seem to be registered" });
    }

    // Check if account is locked
    const isLocked = user.tempLock && user.tempLock > Date.now();
    if (isLocked) {
      return res.status(423).json({
        message: "Oops! You've tried to log in too many times. Please wait a bit and try again"
      });
    }

    const isCorrect = await bcrypt.compare(password, user.password);

    if (isCorrect === false) {
      // inc signIn attempts
      const updates = { $inc: { attempts: 1 } };

      // Lock account for 10 minutes
      const shouldLock = user.attempts >= 4;
      if (shouldLock) {
        updates.$set = {
          tempLock: Date.now() + 10 * 60 * 1000, // 10 minutes
          attempts: 0
        };
      }

      await User.findByIdAndUpdate(user._id, updates);
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Clear attempts and set lastsignIn
    await User.findByIdAndUpdate(user._id, {
      $unset: { attempts: 1, tempLock: 1 },
      $set: { lastsignIn: new Date() }
    });

    generateToken(user._id, res);

    return res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      avatar: user.avatar,
    });

  } catch (err) {
    console.error(`Login error: ${err}`);
    return res.status(500).json({ message: "Server error, try again later" });
  }
};

// logs out the user by clearing the JWT cookie
export const signOut = (req, res) => {
  try {
    // Invalidate the JWT cookie by setting it to an empty string and expiring it immediately
    res.clearCookie("jwt", { maxAge: 0 }); // alt: clearCookie instead of res.cookie
    return res.status(200).json({ message: "See you next time!" });
  } catch (e) {
    console.log("Logout failed", e);
    res.status(500).json({ message: "Couldn't log you out properly" });
  }
};

// updates user's profile picture (with Cloudinary)
export const updateProfile = async (req, res) => {
  try {
    const { avatar } = req.body;
    const userId = req.user._id;

    if (avatar == null || avatar === "") {
      return res.status(400).json({ message: "Profile pic is required" });
    }

    const result = await cloudinary.uploader.upload(avatar);
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { avatar: result.secure_url },
      { returnDocument: "after" } 
    );

    return res.status(200).json(updatedUser);
  } catch (error) {
    console.log("Profile update error:", error);
    return res.status(500).json({ message: "Failed to update profile", error: true });
  }
};

// returns the authenticated user's data (frontend)
export const checkAuth = (req, res) => {
  try {
    const authenticatedUser = req.user;
    return res.status(200).json(authenticatedUser);
  } catch (error) {
    console.log("Error in checkAuth controller", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};