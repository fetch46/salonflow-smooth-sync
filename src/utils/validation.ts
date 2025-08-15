// Input validation utilities

import { APP_CONFIG } from '@/lib/constants';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Email validation
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];
  
  if (!email) {
    errors.push('Email is required');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push('Please enter a valid email address');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Password validation
export function validatePassword(password: string): ValidationResult {
  const errors: string[] = [];
  
  if (!password) {
    errors.push('Password is required');
  } else {
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (!/(?=.*[a-z])/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/(?=.*\d)/.test(password)) {
      errors.push('Password must contain at least one number');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Generic string validation
export function validateString(value: string, options: {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  fieldName?: string;
} = {}): ValidationResult {
  const {
    required = false,
    minLength = 0,
    maxLength = APP_CONFIG.LIMITS.MAX_NAME_LENGTH,
    pattern,
    fieldName = 'Field'
  } = options;
  
  const errors: string[] = [];
  
  if (required && (!value || value.trim().length === 0)) {
    errors.push(`${fieldName} is required`);
    return { isValid: false, errors };
  }
  
  if (value) {
    const trimmed = value.trim();
    
    if (trimmed.length < minLength) {
      errors.push(`${fieldName} must be at least ${minLength} characters long`);
    }
    
    if (trimmed.length > maxLength) {
      errors.push(`${fieldName} must be no more than ${maxLength} characters long`);
    }
    
    if (pattern && !pattern.test(trimmed)) {
      errors.push(`${fieldName} format is invalid`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Number validation
export function validateNumber(value: number | string, options: {
  required?: boolean;
  min?: number;
  max?: number;
  fieldName?: string;
} = {}): ValidationResult {
  const {
    required = false,
    min,
    max,
    fieldName = 'Field'
  } = options;
  
  const errors: string[] = [];
  
  if (required && (value === undefined || value === null || value === '')) {
    errors.push(`${fieldName} is required`);
    return { isValid: false, errors };
  }
  
  if (value !== undefined && value !== null && value !== '') {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(numValue)) {
      errors.push(`${fieldName} must be a valid number`);
    } else {
      if (min !== undefined && numValue < min) {
        errors.push(`${fieldName} must be at least ${min}`);
      }
      
      if (max !== undefined && numValue > max) {
        errors.push(`${fieldName} must be no more than ${max}`);
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Date validation
export function validateDate(value: string | Date, options: {
  required?: boolean;
  minDate?: Date;
  maxDate?: Date;
  fieldName?: string;
} = {}): ValidationResult {
  const {
    required = false,
    minDate,
    maxDate,
    fieldName = 'Date'
  } = options;
  
  const errors: string[] = [];
  
  if (required && !value) {
    errors.push(`${fieldName} is required`);
    return { isValid: false, errors };
  }
  
  if (value) {
    const date = typeof value === 'string' ? new Date(value) : value;
    
    if (isNaN(date.getTime())) {
      errors.push(`${fieldName} must be a valid date`);
    } else {
      if (minDate && date < minDate) {
        errors.push(`${fieldName} must be after ${minDate.toLocaleDateString()}`);
      }
      
      if (maxDate && date > maxDate) {
        errors.push(`${fieldName} must be before ${maxDate.toLocaleDateString()}`);
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Sanitize input to prevent XSS
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
    .slice(0, APP_CONFIG.LIMITS.MAX_DESCRIPTION_LENGTH);
}

// Validate and sanitize form data
export function validateFormData(data: Record<string, any>, schema: Record<string, any>): {
  isValid: boolean;
  errors: Record<string, string[]>;
  sanitizedData: Record<string, any>;
} {
  const errors: Record<string, string[]> = {};
  const sanitizedData: Record<string, any> = {};
  
  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];
    const fieldErrors: string[] = [];
    
    // Apply validation rules
    if (rules.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
      fieldErrors.push(`${rules.label || field} is required`);
    }
    
    if (value) {
      // Type-specific validation
      if (rules.type === 'email') {
        const emailResult = validateEmail(value);
        fieldErrors.push(...emailResult.errors);
      } else if (rules.type === 'string') {
        const stringResult = validateString(value, {
          minLength: rules.minLength,
          maxLength: rules.maxLength,
          pattern: rules.pattern,
          fieldName: rules.label || field
        });
        fieldErrors.push(...stringResult.errors);
      } else if (rules.type === 'number') {
        const numberResult = validateNumber(value, {
          min: rules.min,
          max: rules.max,
          fieldName: rules.label || field
        });
        fieldErrors.push(...numberResult.errors);
      }
      
      // Sanitize string values
      if (typeof value === 'string') {
        sanitizedData[field] = sanitizeInput(value);
      } else {
        sanitizedData[field] = value;
      }
    } else {
      sanitizedData[field] = value;
    }
    
    if (fieldErrors.length > 0) {
      errors[field] = fieldErrors;
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitizedData
  };
}