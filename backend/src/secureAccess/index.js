import rateLimit from "express-rate-limit";
import helmet from "helmet";
import xss from "xss";
import jwt from "jsonwebtoken";
import User from "../schema/userSchema.js";

// Rate limiters
export const createLimiter = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: { error: message },
  standardHeaders: true,
  legacyHeaders: false,
});

export const limiters = {
  general: createLimiter(10 * 60 * 1000, 100, "Too many requests"),
  auth: createLimiter(10 * 60 * 1000, 50, "Too many login attempts"),
  messages: createLimiter(60 * 1000, 30, "Sending messages too fast")
};

// Security headers
export const secHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false
});

// XSS protection
export const xssProtection = (req, res, next) => {
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === "string" && key !== "image") {
        req.body[key] = xss(req.body[key], {
          whiteList: {},
          stripIgnoreTag: true,
          stripIgnoreTagBody: ["script"]
        });
      }
    });
  }
  next();
};

// Input validation
export const validateInput = (req, res, next) => {
  const suspiciousPatterns = [
    /(<script.*?>.*?<\/script>)/gi,
    /(javascript:)/gi,
    /(onload=|onerror=|onclick=)/gi,
    /(eval\(|setTimeout\(|setInterval\()/gi
  ];

  const checkStr = (str) => suspiciousPatterns.some(pattern => pattern.test(str));
  
  if (req.body) {
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === "string" && checkStr(value)) {
        return res.status(400).json({ error: "Invalid input detected" });
      }
    }
  }
  next();
};

// NoSQL injection protection
export const sqlProtect = (req, res, next) => {
  const hasInjection = (obj) => {
    if (typeof obj === "object" && obj !== null) {
      for (const key in obj) {
        if (key.startsWith("$") || key.includes(".")) return true;
        if (typeof obj[key] === "object" && hasInjection(obj[key])) return true;
      }
    }
    return false;
  };

  if (hasInjection(req.body) || hasInjection(req.query) || hasInjection(req.params)) {
    return res.status(400).json({ error: "Invalid request format" });
  }
  next();
};

// Auth middleware (consolidated from two files)
export const protectRoute = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;
    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded) {
      return res.status(401).json({ message: "Invalid token" });
    }

    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ message: "Authentication error" });
  }
};

// Combined security middleware
export const security = [secHeaders, limiters.general, xssProtection, validateInput, sqlProtect];