import { registerAPPrompts, getPromptInfo } from '../../src/prompts/APPrompts.js';
import { ContentService } from '../../src/services/ContentService.js';
import { MonitoringService } from '../../src/services/MonitoringService.js';

// Mock the template modules
jest.mock('../../src/prompts/templates/search.prompts.js', () => ({
  registerSearchPrompts: jest.fn()
}));

jest.mock('../../src/prompts/templates/monitoring.prompts.js', () => ({
  registerMonitoringPrompts: jest.fn()
}));

jest.mock('../../src/prompts/templates/analysis.prompts.js', () => ({
  registerAnalysisPrompts: jest.fn()
}));

jest.mock('../../src/prompts/templates/workflow.prompts.js', () => ({
  registerWorkflowPrompts: jest.fn()
}));

describe('APPrompts', () => {
  let mockServer: any;
  let mockContentService: ContentService;
  let mockMonitoringService: MonitoringService;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    // Mock server
    mockServer = {
      registerPrompt: jest.fn()
    };

    // Mock services
    mockContentService = {} as ContentService;
    mockMonitoringService = {} as MonitoringService;

    // Spy on console.log
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('registerAPPrompts', () => {
    it('should register all prompt categories', async () => {
      const { registerSearchPrompts } = await import('../../src/prompts/templates/search.prompts.js');
      const { registerMonitoringPrompts } = await import('../../src/prompts/templates/monitoring.prompts.js');
      const { registerAnalysisPrompts } = await import('../../src/prompts/templates/analysis.prompts.js');
      const { registerWorkflowPrompts } = await import('../../src/prompts/templates/workflow.prompts.js');

      registerAPPrompts(mockServer, mockContentService, mockMonitoringService);

      // Verify all registration functions were called
      expect(registerSearchPrompts).toHaveBeenCalledWith(mockServer, mockContentService);
      expect(registerMonitoringPrompts).toHaveBeenCalledWith(mockServer, mockMonitoringService);
      expect(registerAnalysisPrompts).toHaveBeenCalledWith(mockServer, mockContentService);
      expect(registerWorkflowPrompts).toHaveBeenCalledWith(mockServer, mockContentService);
    });

    it('should log successful registration', () => {
      registerAPPrompts(mockServer, mockContentService, mockMonitoringService);

      // Check that success message was logged
      expect(consoleLogSpy).toHaveBeenCalledWith('✅ AP Media API Prompts registered successfully');
      
      // Check that prompt lists were logged
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Search prompts:'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Monitoring prompts:'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Analysis prompts:'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Workflow prompts:'));
    });
  });

  describe('getPromptInfo', () => {
    it('should return prompt information structure', () => {
      const info = getPromptInfo();

      expect(info).toHaveProperty('categories');
      expect(info).toHaveProperty('total_prompts');
      expect(info).toHaveProperty('benefits');
    });

    it('should have correct category structure', () => {
      const info = getPromptInfo();

      expect(info.categories).toHaveProperty('search');
      expect(info.categories).toHaveProperty('monitoring');
      expect(info.categories).toHaveProperty('analysis');
      expect(info.categories).toHaveProperty('workflow');

      // Check search category
      expect(info.categories.search).toHaveProperty('description');
      expect(info.categories.search).toHaveProperty('prompts');
      expect(info.categories.search.prompts).toContain('breaking-news-search');
      expect(info.categories.search.prompts).toContain('smart-search');
    });

    it('should have correct total prompt count', () => {
      const info = getPromptInfo();
      expect(info.total_prompts).toBe(17);
    });

    it('should list benefits', () => {
      const info = getPromptInfo();

      expect(info.benefits).toBeInstanceOf(Array);
      expect(info.benefits).toContain('Simplified access to AP Media API functionality');
      expect(info.benefits).toContain('Optimized parameters for common use cases');
      expect(info.benefits).toContain('Natural language interaction patterns');
    });

    it('should have all prompt names in categories', () => {
      const info = getPromptInfo();

      // Search prompts
      expect(info.categories.search.prompts).toHaveLength(5);
      expect(info.categories.search.prompts).toContain('breaking-news-search');
      expect(info.categories.search.prompts).toContain('topic-deep-dive');
      expect(info.categories.search.prompts).toContain('multimedia-search');
      expect(info.categories.search.prompts).toContain('regional-coverage');
      expect(info.categories.search.prompts).toContain('smart-search');

      // Monitoring prompts
      expect(info.categories.monitoring.prompts).toHaveLength(4);
      expect(info.categories.monitoring.prompts).toContain('create-news-monitor');
      expect(info.categories.monitoring.prompts).toContain('breaking-alert-setup');
      expect(info.categories.monitoring.prompts).toContain('list-monitors');
      expect(info.categories.monitoring.prompts).toContain('manage-monitor');

      // Analysis prompts
      expect(info.categories.analysis.prompts).toHaveLength(4);
      expect(info.categories.analysis.prompts).toContain('trend-analysis');
      expect(info.categories.analysis.prompts).toContain('content-recommendations');
      expect(info.categories.analysis.prompts).toContain('coverage-comparison');
      expect(info.categories.analysis.prompts).toContain('quick-trending');

      // Workflow prompts
      expect(info.categories.workflow.prompts).toHaveLength(4);
      expect(info.categories.workflow.prompts).toContain('daily-news-briefing');
      expect(info.categories.workflow.prompts).toContain('research-workflow');
      expect(info.categories.workflow.prompts).toContain('content-curation');
      expect(info.categories.workflow.prompts).toContain('story-development');
    });
  });
});