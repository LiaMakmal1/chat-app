// Security middleware to protect against common vulnerabilities
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import xss from "xss";

// Rate limiting to prevent brute force attacks
export const createRateLimit = (windowMs = 15 * 60 * 1000, max = 100) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: "Too many requests from this IP, please try again later."
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Rate limit for login attempts
export const loginRateLimit = createRateLimit(15 * 60 * 1000, 5); // 5 attempts per 15 minutes

// Rate limit for message sending
export const messageRateLimit = createRateLimit(60 * 1000, 30); // 30 messages per minute

// XSS protection middleware
export const xssProtection = (req, res, next) => {
  if (req.body) {
    // Clean text content from XSS
    if (req.body.text) {
      req.body.text = xss(req.body.text, {
        whiteList: {}, // No HTML tags allowed
        stripIgnoreTag: true,
        stripIgnoreTagBody: ["script"]
      });
    }
    
    // Clean other string fields
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

// Input validation middleware
export const validateInput = (req, res, next) => {
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /(<script.*?>.*?<\/script>)/gi,
    /(javascript:)/gi,
    /(onload=|onerror=|onclick=)/gi,
    /(eval\(|setTimeout\(|setInterval\()/gi,
    /(\$\(|jQuery)/gi
  ];
  
  const checkString = (str) => {
    return suspiciousPatterns.some(pattern => pattern.test(str));
  };
  
  // Check request body for malicious content
  if (req.body) {
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === "string" && checkString(value)) {
        return res.status(400).json({ 
          error: "Invalid input detected",
          field: key 
        });
      }
    }
  }
  
  next();
};

// Security headers middleware
export const securityHeaders = helmet({
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

// SQL injection protection (for NoSQL injection in this case)
export const noSqlInjectionProtection = (req, res, next) => {
  const checkForInjection = (obj) => {
    if (typeof obj === "object" && obj !== null) {
      for (const key in obj) {
        if (key.startsWith("$") || key.includes(".")) {
          return true;
        }
        if (typeof obj[key] === "object") {
          if (checkForInjection(obj[key])) {
            return true;
          }
        }
      }
    }
    return false;
  };
  
  if (checkForInjection(req.body) || checkForInjection(req.query) || checkForInjection(req.params)) {
    return res.status(400).json({ error: "Invalid request format" });
  }
  
  next();
};