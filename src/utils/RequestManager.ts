/**
 * Request Manager for handling cancellable operations
 * Provides a simple interface for managing AbortControllers
 */

export class RequestManager {
  private activeRequests = new Map<string, AbortController>();

  /**
   * Create a new cancellable request
   * @param requestId Unique identifier for this request
   * @returns AbortSignal to pass to HTTP client
   */
  createRequest(requestId: string): AbortSignal {
    // Cancel any existing request with the same ID
    this.cancelRequest(requestId);

    const controller = new AbortController();
    this.activeRequests.set(requestId, controller);
    
    // Clean up when request completes or aborts
    controller.signal.addEventListener('abort', () => {
      this.activeRequests.delete(requestId);
    }, { once: true });

    return controller.signal;
  }

  /**
   * Cancel a specific request
   * @param requestId The request to cancel
   * @returns true if request was cancelled, false if not found
   */
  cancelRequest(requestId: string): boolean {
    const controller = this.activeRequests.get(requestId);
    if (controller && !controller.signal.aborted) {
      controller.abort();
      this.activeRequests.delete(requestId);
      return true;
    }
    return false;
  }

  /**
   * Cancel all active requests
   */
  cancelAll(): void {
    for (const [id, controller] of this.activeRequests) {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    }
    this.activeRequests.clear();
  }

  /**
   * Get the number of active requests
   */
  getActiveCount(): number {
    // Clean up any aborted requests that weren't removed
    for (const [id, controller] of this.activeRequests) {
      if (controller.signal.aborted) {
        this.activeRequests.delete(id);
      }
    }
    return this.activeRequests.size;
  }

  /**
   * Check if a specific request is active
   */
  isActive(requestId: string): boolean {
    const controller = this.activeRequests.get(requestId);
    return controller !== undefined && !controller.signal.aborted;
  }

  /**
   * Clean up all resources
   */
  destroy(): void {
    this.cancelAll();
  }
}

/**
 * Global request manager instance for the MCP server
 */
export const globalRequestManager = new RequestManager();