import { generateToken } from "../lib/tools.js";
import User from "../schema/userSchema.js";
import bcrypt from "bcryptjs";
import cloudinary from "../lib/cloudinary.js";

export const signup = async (req, res) => {
  const { fullName, email, password } = req.body;

  try {
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "All fields required" });
    }

    if (password.length < 8 || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(password)) {
      return res.status(400).json({ 
        message: "Password must be 8+ chars with upper, lower, number, special char" 
      });
    }

    if (await User.findOne({ email })) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const newUser = await User.create({
      fullName,
      email,
      password: await bcrypt.hash(password, 10),
    });

    generateToken(newUser._id, res);

    res.status(201).json({
      _id: newUser._id,
      fullName: newUser.fullName,
      email: newUser.email,
      avatar: newUser.avatar,
    });
  } catch (error) {
    res.status(500).json({ message: "Signup failed" });
  }
};

export const signIn = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (user.tempLock && user.tempLock > Date.now()) {
      return res.status(423).json({ message: "Account temporarily locked" });
    }

    if (!(await bcrypt.compare(password, user.password))) {
      const updates = { $inc: { attempts: 1 } };
      if (user.attempts >= 4) {
        updates.$set = { tempLock: Date.now() + 600000, attempts: 0 };
      }
      await User.findByIdAndUpdate(user._id, updates);
      return res.status(400).json({ message: "Invalid credentials" });
    }

    await User.findByIdAndUpdate(user._id, {
      $unset: { attempts: 1, tempLock: 1 },
      $set: { lastsignIn: new Date() }
    });

    generateToken(user._id, res);

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      avatar: user.avatar,
    });
  } catch (error) {
    res.status(500).json({ message: "Login failed" });
  }
};

export const signOut = (req, res) => {
  try {
    res.clearCookie("jwt", { maxAge: 0 });
    res.status(200).json({ message: "Logged out" });
  } catch (error) {
    res.status(500).json({ message: "Logout failed" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { avatar } = req.body;
    if (!avatar) return res.status(400).json({ message: "Avatar required" });

    const { secure_url } = await cloudinary.uploader.upload(avatar);
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: secure_url },
      { new: true }
    );

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Update failed" });
  }
};

export const checkAuth = (req, res) => res.status(200).json(req.user);