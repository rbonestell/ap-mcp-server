import { APValidationError } from '../errors/APError.js';

/**
 * Simple validation functions without Zod dependency
 */

/**
 * Validation utility functions
 */
export class Validators {
  /**
   * Validate email address
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate URL
   */
  static isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Validate date string (ISO format or common formats)
   */
  static isValidDateString(dateString: string): boolean {
    // YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return !isNaN(Date.parse(dateString));
    }
    
    // YYYY-MM-DDTHH:mm:ss format
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(dateString)) {
      return !isNaN(Date.parse(dateString));
    }

    // ISO-8601 Duration format
    if (/^P\d+[YMWD]$/.test(dateString) || /^PT\d+[HMS]$/.test(dateString)) {
      return true;
    }

    return false;
  }

  /**
   * Validate item ID format
   */
  static isValidItemId(itemId: string): boolean {
    return typeof itemId === 'string' && itemId.trim().length > 0;
  }

  /**
   * Validate monitor name format
   */
  static isValidMonitorName(name: string): boolean {
    return typeof name === 'string' && 
           name.length >= 1 && 
           name.length <= 20 && 
           /^[a-zA-Z0-9_.-]*$/.test(name);
  }

  /**
   * Validate RSS ID
   */
  static isValidRSSId(rssId: number): boolean {
    return Number.isInteger(rssId) && rssId > 0;
  }

  /**
   * Validate page size
   */
  static isValidPageSize(pageSize: number): boolean {
    return Number.isInteger(pageSize) && pageSize >= 1 && pageSize <= 100;
  }

  /**
   * Sanitize query string for AP API
   */
  static sanitizeQuery(query: string): string {
    // Remove potential injection characters and normalize
    return query
      .replace(/[<>]/g, '') // Remove HTML-like characters
      .replace(/['"]/g, '"') // Normalize quotes
      .trim();
  }

  /**
   * Validate and sanitize include/exclude arrays
   */
  static sanitizeFieldArray(fields: string[]): string[] {
    return fields
      .filter(field => typeof field === 'string' && field.trim().length > 0)
      .map(field => field.trim())
      .filter((field, index, arr) => arr.indexOf(field) === index); // Remove duplicates
  }

  /**
   * Create date range validation
   */
  static validateDateRange(minDate?: string, maxDate?: string): void {
    if (minDate && !this.isValidDateString(minDate)) {
      throw new APValidationError('min_date format is invalid', 'min_date', { minDate });
    }

    if (maxDate && !this.isValidDateString(maxDate)) {
      throw new APValidationError('max_date format is invalid', 'max_date', { maxDate });
    }

    if (minDate && maxDate) {
      const min = new Date(minDate);
      const max = new Date(maxDate);
      const daysDiff = (max.getTime() - min.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff < 0) {
        throw new APValidationError('min_date must be before max_date', 'date_range', { minDate, maxDate });
      }

      if (daysDiff > 60) {
        throw new APValidationError('Date range cannot exceed 60 days', 'date_range', { 
          minDate, 
          maxDate, 
          days: Math.round(daysDiff) 
        });
      }
    }
  }

  /**
   * Validate search parameters
   */
  static validateSearchParams(params: any): any {
    const validated: any = {};
    
    if (params.q !== undefined) {
      validated.q = String(params.q);
    }
    
    if (params.include !== undefined) {
      if (!Array.isArray(params.include)) {
        throw new APValidationError('include must be an array');
      }
      validated.include = this.sanitizeFieldArray(params.include);
    }
    
    if (params.exclude !== undefined) {
      if (!Array.isArray(params.exclude)) {
        throw new APValidationError('exclude must be an array');
      }
      validated.exclude = this.sanitizeFieldArray(params.exclude);
    }
    
    if (params.page !== undefined) {
      if (!/^\d+$/.test(String(params.page))) {
        throw new APValidationError('page must be a numeric string');
      }
      validated.page = String(params.page);
    }
    
    if (params.page_size !== undefined) {
      if (!this.isValidPageSize(params.page_size)) {
        throw new APValidationError('page_size must be between 1 and 100');
      }
      validated.page_size = params.page_size;
    }
    
    if (params.pricing !== undefined) {
      validated.pricing = Boolean(params.pricing);
    }
    
    if (params.in_my_plan !== undefined) {
      validated.in_my_plan = Boolean(params.in_my_plan);
    }
    
    if (params.session_label !== undefined) {
      validated.session_label = String(params.session_label);
    }
    
    return validated;
  }

  /**
   * Validate feed parameters
   */
  static validateFeedParams(params: any): any {
    const validated: any = {};
    
    if (params.q !== undefined) {
      validated.q = String(params.q);
    }
    
    if (params.include !== undefined) {
      if (!Array.isArray(params.include)) {
        throw new APValidationError('include must be an array');
      }
      validated.include = this.sanitizeFieldArray(params.include);
    }
    
    if (params.exclude !== undefined) {
      if (!Array.isArray(params.exclude)) {
        throw new APValidationError('exclude must be an array');
      }
      validated.exclude = this.sanitizeFieldArray(params.exclude);
    }
    
    if (params.page_size !== undefined) {
      if (!this.isValidPageSize(params.page_size)) {
        throw new APValidationError('page_size must be between 1 and 100');
      }
      validated.page_size = params.page_size;
    }
    
    if (params.pricing !== undefined) {
      validated.pricing = Boolean(params.pricing);
    }
    
    if (params.in_my_plan !== undefined) {
      validated.in_my_plan = Boolean(params.in_my_plan);
    }
    
    if (params.with_monitor !== undefined) {
      const monitor = String(params.with_monitor);
      if (monitor.length < 4 || monitor.length > 24 || !/^[a-zA-Z0-9_.-]*$/.test(monitor)) {
        throw new APValidationError('with_monitor must be 4-24 characters, alphanumeric with underscores, dots, hyphens');
      }
      validated.with_monitor = monitor;
    }
    
    if (params.session_label !== undefined) {
      validated.session_label = String(params.session_label);
    }
    
    if (params.filter_out !== undefined) {
      validated.filter_out = String(params.filter_out);
    }
    
    return validated;
  }

  /**
   * Validate monitor definition
   */
  static validateMonitor(monitor: any): any {
    if (!monitor.name || !this.isValidMonitorName(monitor.name)) {
      throw new APValidationError('Monitor name must be 1-20 characters, alphanumeric with underscores, dots, hyphens');
    }

    if (!monitor.notify || !Array.isArray(monitor.notify) || monitor.notify.length === 0 || monitor.notify.length > 5) {
      throw new APValidationError('Monitor must have 1-5 notification channels');
    }

    monitor.notify.forEach((notification: any, index: number) => {
      if (notification.channelType !== 'email') {
        throw new APValidationError(`Notification ${index + 1}: channelType must be "email"`);
      }
      
      if (!Array.isArray(notification.channelDestinations) || notification.channelDestinations.length === 0) {
        throw new APValidationError(`Notification ${index + 1}: channelDestinations must be non-empty array`);
      }
      
      notification.channelDestinations.forEach((email: string) => {
        if (!this.isValidEmail(email)) {
          throw new APValidationError(`Invalid email address: ${email}`);
        }
      });
    });

    if (!monitor.conditions || !Array.isArray(monitor.conditions) || monitor.conditions.length === 0 || monitor.conditions.length > 5) {
      throw new APValidationError('Monitor must have 1-5 conditions');
    }

    monitor.conditions.forEach((condition: any, index: number) => {
      if (!['idleFeed', 'quality'].includes(condition.type)) {
        throw new APValidationError(`Condition ${index + 1}: type must be "idleFeed" or "quality"`);
      }
      
      if (typeof condition.enabled !== 'boolean') {
        throw new APValidationError(`Condition ${index + 1}: enabled must be boolean`);
      }
      
      if (condition.type === 'idleFeed' && !condition.criteria?.idleTime) {
        throw new APValidationError(`Condition ${index + 1}: idleTime required for idleFeed type`);
      }
    });

    return monitor;
  }
}