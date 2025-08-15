import { Request, Response, NextFunction } from 'express';

// Input sanitization middleware
export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  // Sanitize string inputs to prevent XSS
  const sanitizeStringValue = (value: any): any => {
    if (typeof value === 'string') {
      return value
        .replace(/[<>]/g, '') // Remove potential HTML tags
        .trim()
        .slice(0, 1000); // Limit string length
    }
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const sanitized: any = {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = sanitizeStringValue(val);
      }
      return sanitized;
    }
    if (Array.isArray(value)) {
      return value.map(sanitizeStringValue);
    }
    return value;
  };

  if (req.body) {
    req.body = sanitizeStringValue(req.body);
  }
  if (req.query) {
    req.query = sanitizeStringValue(req.query);
  }

  next();
}

// Rate limiting state (in-memory for simplicity)
const rateLimitState = new Map<string, { count: number; resetTime: number }>();

// Simple rate limiting middleware
export function rateLimit(maxRequests = 100, windowMs = 15 * 60 * 1000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    
    const clientState = rateLimitState.get(key);
    
    if (!clientState || now > clientState.resetTime) {
      rateLimitState.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    if (clientState.count >= maxRequests) {
      return res.status(429).json({ 
        error: 'Too many requests', 
        retryAfter: Math.ceil((clientState.resetTime - now) / 1000) 
      });
    }
    
    clientState.count++;
    next();
  };
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, state] of rateLimitState.entries()) {
    if (now > state.resetTime) {
      rateLimitState.delete(key);
    }
  }
}, 60000); // Clean up every minute