import rateLimit from "express-rate-limit";
import helmet from "helmet";
import xss from "xss";
export const rateLimiter   = (windowMs = 10 * 60 * 1000, max = 100) => {
  return rateLimit({windowMs, max,
    message: {
      error: "You've been temporarily locked out due to too many requests. Please try again later"
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Rate limit for signIn attempts
export const logLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: {
    error: "Too many signIn attempts. Try again in 10 minutes.",
  },
});

// Rate limit for message sending (30)
export const msgLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    error: "You're sending messages too fast. Slow down a bit!",
  },
});

export const xssProtection = (req, res, next) => {
  if (req.body) {
    if (req.body.text) {
      req.body.text = xss(req.body.text, {
        whiteList: {},
        stripIgnoreTag: true,
        stripIgnoreTagBody: ["script"]
      });
    }
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

export const validateInput = (req, res, next) => {
  const suspiciousPatterns = [
    /(<script.*?>.*?<\/script>)/gi,
    /(javascript:)/gi,
    /(onload=|onerror=|onclick=)/gi,
    /(eval\(|setTimeout\(|setInterval\()/gi,
    /(\$\(|jQuery)/gi
  ];

  const checkStr = (str) => {
    return suspiciousPatterns.some(pattern => pattern.test(str));
  };
  if (req.body) {
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === "string" && checkStr(value)) {
        return res.status(400).json({ 
          error: "Invalid input detected",
          field: key 
        });
      }
    }
  }

  next();
};

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

export const sqlProtect = (req, res, next) => {
  const injectCheck = (obj) => {
    if (typeof obj === "object" && obj !== null) {
      for (const key in obj) {
        if (key.startsWith("$") || key.includes(".")) {
          return true;
        }
        if (typeof obj[key] === "object") {
          if (injectCheck(obj[key])) {
            return true;
          }
        }
      }
    }
    return false;
  };

  if (injectCheck(req.body) || injectCheck(req.query) || injectCheck(req.params)) {
    return res.status(400).json({ error: "Invalid request format" });
  }

  next();
};
