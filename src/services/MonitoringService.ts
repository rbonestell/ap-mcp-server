import { APHttpClient } from '../http/APHttpClient.js';
import { Monitor, MonitorsResponse } from '../types/api.types.js';
import { APValidationError, APError } from '../errors/APError.js';

/**
 * Service for AP Monitoring and Alerts API operations
 */
export class MonitoringService {
  constructor(private readonly httpClient: APHttpClient) {}

  /**
   * Create a new monitor
   * @param monitor Monitor definition
   * @returns Created monitor response
   */
  async createMonitor(monitor: Monitor): Promise<MonitorsResponse> {
    this.validateMonitor(monitor);

    try {
      const response = await this.httpClient.post<MonitorsResponse>('account/monitors/create', { monitor });
      return response.data;
    } catch (error) {
      throw this.handleServiceError('createMonitor', error, { monitor });
    }
  }

  /**
   * Update an existing monitor
   * @param monitorId Monitor ID or name
   * @param monitor Monitor definition
   * @returns Updated monitor response
   */
  async updateMonitor(monitorId: string, monitor: Monitor): Promise<MonitorsResponse> {
    if (!monitorId || typeof monitorId !== 'string') {
      throw new APValidationError('Monitor ID is required and must be a string', 'monitorId', { monitorId });
    }

    this.validateMonitor(monitor);

    try {
      const response = await this.httpClient.post<MonitorsResponse>(
        `account/monitors/${encodeURIComponent(monitorId)}/update`,
        { monitor }
      );
      return response.data;
    } catch (error) {
      throw this.handleServiceError('updateMonitor', error, { monitorId, monitor });
    }
  }

  /**
   * Delete a monitor
   * @param monitorId Monitor ID or name
   * @returns Deletion response
   */
  async deleteMonitor(monitorId: string): Promise<MonitorsResponse> {
    if (!monitorId || typeof monitorId !== 'string') {
      throw new APValidationError('Monitor ID is required and must be a string', 'monitorId', { monitorId });
    }

    try {
      const response = await this.httpClient.delete<MonitorsResponse>(
        `account/monitors/${encodeURIComponent(monitorId)}/delete`
      );
      return response.data;
    } catch (error) {
      throw this.handleServiceError('deleteMonitor', error, { monitorId });
    }
  }

  /**
   * List all monitors
   * @returns List of monitors
   */
  async listMonitors(): Promise<MonitorsResponse> {
    try {
      const response = await this.httpClient.get<MonitorsResponse>('account/monitors');
      return response.data;
    } catch (error) {
      throw this.handleServiceError('listMonitors', error);
    }
  }

  /**
   * Get a specific monitor by ID
   * @param monitorId Monitor ID or name
   * @returns Monitor details
   */
  async getMonitor(monitorId: string): Promise<MonitorsResponse> {
    if (!monitorId || typeof monitorId !== 'string') {
      throw new APValidationError('Monitor ID is required and must be a string', 'monitorId', { monitorId });
    }

    try {
      const response = await this.httpClient.get<MonitorsResponse>(
        `account/monitors/${encodeURIComponent(monitorId)}`
      );
      return response.data;
    } catch (error) {
      throw this.handleServiceError('getMonitor', error, { monitorId });
    }
  }

  /**
   * Get recent alerts
   * @param options Alert query options
   * @returns Recent alerts
   */
  async getRecentAlerts(options: {
    show_detail?: boolean;
    agentid?: string;
  } = {}): Promise<MonitorsResponse> {
    this.validateAlertParams(options);

    try {
      const response = await this.httpClient.get<MonitorsResponse>('account/monitors/alerts', options);
      return response.data;
    } catch (error) {
      throw this.handleServiceError('getRecentAlerts', error, options);
    }
  }

  /**
   * Get monitored sessions
   * @param options Session query options
   * @returns Monitored sessions
   */
  async getMonitoredSessions(options: {
    show_detail?: boolean;
    agentid?: string;
  } = {}): Promise<MonitorsResponse> {
    this.validateSessionParams(options);

    try {
      const response = await this.httpClient.get<MonitorsResponse>('account/monitors/sessions', options);
      return response.data;
    } catch (error) {
      throw this.handleServiceError('getMonitoredSessions', error, options);
    }
  }

  /**
   * Get a specific monitored session
   * @param sessionId Session ID
   * @param showDetail Whether to show detailed information
   * @returns Session details
   */
  async getMonitoredSession(sessionId: string, showDetail: boolean = false): Promise<MonitorsResponse> {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new APValidationError('Session ID is required and must be a string', 'sessionId', { sessionId });
    }

    try {
      const params = showDetail ? { show_detail: true } : {};
      const response = await this.httpClient.get<MonitorsResponse>(
        `account/monitors/sessions/${encodeURIComponent(sessionId)}`,
        params
      );
      return response.data;
    } catch (error) {
      throw this.handleServiceError('getMonitoredSession', error, { sessionId, showDetail });
    }
  }

  /**
   * Disable monitoring on a session
   * @param sessionId Session ID
   * @param agentId Optional agent ID
   * @returns Response
   */
  async disableSessionMonitor(sessionId: string, agentId?: string): Promise<MonitorsResponse> {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new APValidationError('Session ID is required and must be a string', 'sessionId', { sessionId });
    }

    try {
      const params = agentId ? { agentid: agentId } : {};
      const response = await this.httpClient.get<MonitorsResponse>(
        `account/monitors/sessions/${encodeURIComponent(sessionId)}/disable`,
        params
      );
      return response.data;
    } catch (error) {
      throw this.handleServiceError('disableSessionMonitor', error, { sessionId, agentId });
    }
  }

  /**
   * Enable monitoring on a session
   * @param sessionId Session ID
   * @param agentId Optional agent ID
   * @returns Response
   */
  async enableSessionMonitor(sessionId: string, agentId?: string): Promise<MonitorsResponse> {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new APValidationError('Session ID is required and must be a string', 'sessionId', { sessionId });
    }

    try {
      const params = agentId ? { agentid: agentId } : {};
      const response = await this.httpClient.get<MonitorsResponse>(
        `account/monitors/sessions/${encodeURIComponent(sessionId)}/enable`,
        params
      );
      return response.data;
    } catch (error) {
      throw this.handleServiceError('enableSessionMonitor', error, { sessionId, agentId });
    }
  }

  /**
   * Get monitor status and alerts
   * @param monitorId Monitor ID or name
   * @param options Status query options
   * @returns Monitor status information
   */
  async getMonitorStatus(monitorId: string, options: {
    show_detail?: boolean;
    agentid?: string;
  } = {}): Promise<MonitorsResponse> {
    if (!monitorId || typeof monitorId !== 'string') {
      throw new APValidationError('Monitor ID is required and must be a string', 'monitorId', { monitorId });
    }

    this.validateStatusParams(options);

    try {
      const response = await this.httpClient.get<MonitorsResponse>(
        `account/monitors/${encodeURIComponent(monitorId)}/status`,
        options
      );
      return response.data;
    } catch (error) {
      throw this.handleServiceError('getMonitorStatus', error, { monitorId, options });
    }
  }

  /**
   * Get monitor activity history
   * @param monitorId Monitor ID or name
   * @param options History query options
   * @returns Monitor activity history
   */
  async getMonitorHistory(monitorId: string, options: {
    show_detail?: boolean;
    agentid?: string;
    min_date?: string;
    max_date?: string;
    page?: string;
    page_size?: number;
  } = {}): Promise<MonitorsResponse> {
    if (!monitorId || typeof monitorId !== 'string') {
      throw new APValidationError('Monitor ID is required and must be a string', 'monitorId', { monitorId });
    }

    this.validateHistoryParams(options);

    try {
      const response = await this.httpClient.get<MonitorsResponse>(
        `account/monitors/${encodeURIComponent(monitorId)}/history`,
        options
      );
      return response.data;
    } catch (error) {
      throw this.handleServiceError('getMonitorHistory', error, { monitorId, options });
    }
  }

  /**
   * Validate monitor definition
   */
  private validateMonitor(monitor: Monitor): void {
    if (!monitor.name || typeof monitor.name !== 'string') {
      throw new APValidationError('Monitor name is required and must be a string', 'name');
    }

    if (monitor.name.length < 1 || monitor.name.length > 20) {
      throw new APValidationError('Monitor name must be between 1 and 20 characters', 'name', { 
        name: monitor.name,
        length: monitor.name.length 
      });
    }

    if (!/^[a-zA-Z0-9_.-]*$/.test(monitor.name)) {
      throw new APValidationError('Monitor name can only contain alphanumeric characters, underscores, dots, and hyphens', 'name', { 
        name: monitor.name 
      });
    }

    if (monitor.description && typeof monitor.description !== 'string') {
      throw new APValidationError('Monitor description must be a string', 'description');
    }

    if (monitor.playbook && typeof monitor.playbook !== 'string') {
      throw new APValidationError('Monitor playbook must be a string', 'playbook');
    }

    if (monitor.repeatAlerts) {
      if (typeof monitor.repeatAlerts !== 'string') {
        throw new APValidationError('repeatAlerts must be a string', 'repeatAlerts');
      }

      // Validate ISO-8601 duration format (PT[0-9]*[MH] or 0)
      if (monitor.repeatAlerts !== '0' && !/^PT\d*[MH]$/.test(monitor.repeatAlerts)) {
        throw new APValidationError(
          'repeatAlerts must be in ISO-8601 duration format (PT10M, PT2H) or "0" to disable',
          'repeatAlerts',
          { repeatAlerts: monitor.repeatAlerts }
        );
      }
    }

    if (!monitor.notify || !Array.isArray(monitor.notify)) {
      throw new APValidationError('Monitor notify array is required', 'notify');
    }

    if (monitor.notify.length < 1 || monitor.notify.length > 5) {
      throw new APValidationError('Monitor must have between 1 and 5 notification channels', 'notify', { 
        count: monitor.notify.length 
      });
    }

    monitor.notify.forEach((notification, index) => {
      if (notification.channelType !== 'email') {
        throw new APValidationError(`Notification ${index + 1}: channelType must be "email"`, 'notify');
      }

      if (!notification.channelDestinations || !Array.isArray(notification.channelDestinations)) {
        throw new APValidationError(`Notification ${index + 1}: channelDestinations must be an array`, 'notify');
      }

      if (notification.channelDestinations.length === 0) {
        throw new APValidationError(`Notification ${index + 1}: channelDestinations cannot be empty`, 'notify');
      }

      notification.channelDestinations.forEach((email, emailIndex) => {
        if (typeof email !== 'string' || !this.isValidEmail(email)) {
          throw new APValidationError(
            `Notification ${index + 1}, email ${emailIndex + 1}: invalid email address`,
            'notify',
            { email }
          );
        }
      });
    });

    if (!monitor.conditions || !Array.isArray(monitor.conditions)) {
      throw new APValidationError('Monitor conditions array is required', 'conditions');
    }

    if (monitor.conditions.length < 1 || monitor.conditions.length > 5) {
      throw new APValidationError('Monitor must have between 1 and 5 conditions', 'conditions', { 
        count: monitor.conditions.length 
      });
    }

    monitor.conditions.forEach((condition, index) => {
      if (!['idleFeed', 'quality'].includes(condition.type)) {
        throw new APValidationError(`Condition ${index + 1}: type must be "idleFeed" or "quality"`, 'conditions');
      }

      if (typeof condition.enabled !== 'boolean') {
        throw new APValidationError(`Condition ${index + 1}: enabled must be a boolean`, 'conditions');
      }

      if (condition.type === 'idleFeed') {
        if (!condition.criteria?.idleTime) {
          throw new APValidationError(`Condition ${index + 1}: idleTime is required for idleFeed type`, 'conditions');
        }

        // Validate ISO-8601 duration format for idle time (PT2M to PT12H)
        if (!/^PT(\d+M|\d+H|\d+H\d+M|\d+M\d+S)$/.test(condition.criteria.idleTime)) {
          throw new APValidationError(
            `Condition ${index + 1}: idleTime must be in ISO-8601 duration format (PT2M to PT12H)`,
            'conditions',
            { idleTime: condition.criteria.idleTime }
          );
        }
      }
    });
  }

  /**
   * Validate alert parameters
   */
  private validateAlertParams(options: any): void {
    if (options.show_detail !== undefined && typeof options.show_detail !== 'boolean') {
      throw new APValidationError('show_detail must be a boolean', 'show_detail', { show_detail: options.show_detail });
    }

    if (options.agentid !== undefined && typeof options.agentid !== 'string') {
      throw new APValidationError('agentid must be a string', 'agentid', { agentid: options.agentid });
    }
  }

  /**
   * Validate session parameters
   */
  private validateSessionParams(options: any): void {
    if (options.show_detail !== undefined && typeof options.show_detail !== 'boolean') {
      throw new APValidationError('show_detail must be a boolean', 'show_detail', { show_detail: options.show_detail });
    }

    if (options.agentid !== undefined && typeof options.agentid !== 'string') {
      throw new APValidationError('agentid must be a string', 'agentid', { agentid: options.agentid });
    }
  }

  /**
   * Validate status parameters
   */
  private validateStatusParams(options: any): void {
    if (options.show_detail !== undefined && typeof options.show_detail !== 'boolean') {
      throw new APValidationError('show_detail must be a boolean', 'show_detail', { show_detail: options.show_detail });
    }

    if (options.agentid !== undefined && typeof options.agentid !== 'string') {
      throw new APValidationError('agentid must be a string', 'agentid', { agentid: options.agentid });
    }
  }

  /**
   * Validate history parameters
   */
  private validateHistoryParams(options: any): void {
    if (options.show_detail !== undefined && typeof options.show_detail !== 'boolean') {
      throw new APValidationError('show_detail must be a boolean', 'show_detail', { show_detail: options.show_detail });
    }

    if (options.agentid !== undefined && typeof options.agentid !== 'string') {
      throw new APValidationError('agentid must be a string', 'agentid', { agentid: options.agentid });
    }

    if (options.min_date !== undefined && typeof options.min_date !== 'string') {
      throw new APValidationError('min_date must be a string', 'min_date', { min_date: options.min_date });
    }

    if (options.max_date !== undefined && typeof options.max_date !== 'string') {
      throw new APValidationError('max_date must be a string', 'max_date', { max_date: options.max_date });
    }

    if (options.page !== undefined && typeof options.page !== 'string') {
      throw new APValidationError('page must be a string', 'page', { page: options.page });
    }

    if (options.page_size !== undefined) {
      if (!Number.isInteger(options.page_size) || options.page_size < 1 || options.page_size > 100) {
        throw new APValidationError('page_size must be an integer between 1 and 100', 'page_size', { page_size: options.page_size });
      }
    }

    // Validate individual dates if provided
    if (options.min_date !== undefined) {
      const minDate = new Date(options.min_date);
      if (isNaN(minDate.getTime())) {
        throw new APValidationError('min_date is not a valid date', 'min_date', { min_date: options.min_date });
      }
    }

    if (options.max_date !== undefined) {
      const maxDate = new Date(options.max_date);
      if (isNaN(maxDate.getTime())) {
        throw new APValidationError('max_date is not a valid date', 'max_date', { max_date: options.max_date });
      }
    }

    // Validate date range if both dates are provided
    if (options.min_date && options.max_date) {
      const minDate = new Date(options.min_date);
      const maxDate = new Date(options.max_date);

      if (minDate > maxDate) {
        throw new APValidationError('min_date must be before max_date', 'date_range', { 
          min_date: options.min_date, 
          max_date: options.max_date 
        });
      }
    }
  }

  /**
   * Simple email validation
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Handle service errors with context
   */
  private handleServiceError(operation: string, error: unknown, context?: any): APError {
    if (error instanceof APError) {
      // Add operation context to existing AP errors
      const newDetails = {
        ...error.details,
        operation,
        context,
      };
      return new APError(error.message, error.code, error.statusCode, newDetails);
    }

    // Create new error with context
    return new APError(
      `MonitoringService.${operation} failed: ${error}`,
      'MONITORING_SERVICE_ERROR',
      undefined,
      { operation, context, originalError: error }
    );
  }

  /**
   * Create a basic idle feed monitor
   */
  static createBasicIdleMonitor(
    name: string,
    emailAddresses: string[],
    idleTimeMinutes: number = 15,
    description?: string
  ): Monitor {
    return {
      name,
      description: description || `Monitor for idle feed - ${name}`,
      playbook: 'Check the health of your feed script when no content is received.',
      repeatAlerts: 'PT2H', // Repeat every 2 hours
      notify: [{
        channelType: 'email',
        channelDestinations: emailAddresses,
      }],
      conditions: [{
        type: 'idleFeed',
        enabled: true,
        criteria: {
          idleTime: `PT${idleTimeMinutes}M`,
        },
      }],
    };
  }

  /**
   * Create a quality monitoring monitor
   */
  static createQualityMonitor(
    name: string,
    emailAddresses: string[],
    description?: string
  ): Monitor {
    return {
      name,
      description: description || `Quality monitor - ${name}`,
      playbook: 'Review content quality issues and take appropriate action.',
      repeatAlerts: 'PT1H', // Repeat every hour
      notify: [{
        channelType: 'email',
        channelDestinations: emailAddresses,
      }],
      conditions: [{
        type: 'quality',
        enabled: true,
        criteria: {},
      }],
    };
  }
}