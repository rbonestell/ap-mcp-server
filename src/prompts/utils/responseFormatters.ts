/**
 * Format search results for LLM consumption
 */
export function formatSearchResults(results: any, options?: {
  maxItems?: number;
  includeMetadata?: boolean;
}): string {
  const items = results?.data?.items || [];
  const itemsToShow = options?.maxItems ? items.slice(0, options.maxItems) : items;
  
  const formatted = itemsToShow.map((item: any, index: number) => {
    const parts = [`${index + 1}. ${item.headline || 'No headline'}`];
    
    if (item.published) {
      parts.push(`   Published: ${new Date(item.published).toLocaleString()}`);
    }
    
    if (item.summary) {
      parts.push(`   Summary: ${item.summary.substring(0, 200)}...`);
    }
    
    if (item.byline) {
      parts.push(`   By: ${item.byline}`);
    }
    
    if (item.subject && item.subject.length > 0) {
      const subjects = item.subject.map((s: any) => s.name).join(', ');
      parts.push(`   Topics: ${subjects}`);
    }
    
    if (item.uri) {
      parts.push(`   ID: ${item.item_id || item.uri}`);
    }
    
    return parts.join('\n');
  }).join('\n\n');
  
  if (options?.includeMetadata && results?.data) {
    const metadata = [
      '\n--- Search Metadata ---',
      `Total Results: ${results.data.total || 'Unknown'}`,
      `Page: ${results.data.page || 1}`,
      `Items Shown: ${itemsToShow.length}`
    ].join('\n');
    
    return formatted + '\n' + metadata;
  }
  
  return formatted;
}

/**
 * Format trending topics for LLM consumption
 */
export function formatTrendingTopics(topics: any[]): string {
  if (!topics || topics.length === 0) {
    return 'No trending topics found.';
  }
  
  const formatted = topics.map((topic: any, index: number) => {
    const parts = [`${index + 1}. ${topic.name || topic.subject || 'Unknown topic'}`];
    
    if (topic.frequency) {
      parts.push(`   Mentions: ${topic.frequency}`);
    }
    
    if (topic.trend) {
      parts.push(`   Trend: ${topic.trend}`);
    }
    
    if (topic.category) {
      parts.push(`   Category: ${topic.category}`);
    }
    
    return parts.join('\n');
  }).join('\n\n');
  
  return '=== Trending Topics ===\n' + formatted;
}

/**
 * Format content recommendations
 */
export function formatRecommendations(recommendations: any[]): string {
  if (!recommendations || recommendations.length === 0) {
    return 'No recommendations available.';
  }
  
  const formatted = recommendations.map((item: any, index: number) => {
    const parts = [`${index + 1}. ${item.headline || item.title || 'Untitled'}`];
    
    if (item.relevance_score) {
      parts.push(`   Relevance: ${(item.relevance_score * 100).toFixed(1)}%`);
    }
    
    if (item.reason) {
      parts.push(`   Why: ${item.reason}`);
    }
    
    if (item.summary) {
      parts.push(`   Summary: ${item.summary.substring(0, 150)}...`);
    }
    
    return parts.join('\n');
  }).join('\n\n');
  
  return '=== Content Recommendations ===\n' + formatted;
}

/**
 * Format monitor creation response
 */
export function formatMonitorResponse(monitor: any): string {
  const parts = ['=== Monitor Created Successfully ==='];
  
  if (monitor.name) {
    parts.push(`Name: ${monitor.name}`);
  }
  
  if (monitor.id) {
    parts.push(`ID: ${monitor.id}`);
  }
  
  if (monitor.description) {
    parts.push(`Description: ${monitor.description}`);
  }
  
  if (monitor.conditions && monitor.conditions.length > 0) {
    const conditions = monitor.conditions.map((c: any) => 
      `  - ${c.type}: ${c.enabled ? 'Enabled' : 'Disabled'}`
    ).join('\n');
    parts.push(`Conditions:\n${conditions}`);
  }
  
  if (monitor.notify && monitor.notify.length > 0) {
    const notifications = monitor.notify.map((n: any) =>
      `  - ${n.channelType}: ${n.channelDestinations.join(', ')}`
    ).join('\n');
    parts.push(`Notifications:\n${notifications}`);
  }
  
  return parts.join('\n');
}

/**
 * Format aggregated content analysis
 */
export function formatContentAnalysis(analysis: {
  trends?: any[];
  topStories?: any[];
  coverage?: any;
  sentiment?: any;
}): string {
  const sections = [];
  
  if (analysis.topStories && analysis.topStories.length > 0) {
    sections.push('=== Top Stories ===');
    sections.push(formatSearchResults({ data: { items: analysis.topStories } }));
  }
  
  if (analysis.trends && analysis.trends.length > 0) {
    sections.push('\n' + formatTrendingTopics(analysis.trends));
  }
  
  if (analysis.coverage) {
    sections.push('\n=== Coverage Analysis ===');
    Object.entries(analysis.coverage).forEach(([key, value]) => {
      sections.push(`${key}: ${value}`);
    });
  }
  
  if (analysis.sentiment) {
    sections.push('\n=== Sentiment Analysis ===');
    Object.entries(analysis.sentiment).forEach(([key, value]) => {
      sections.push(`${key}: ${value}`);
    });
  }
  
  return sections.join('\n');
}

/**
 * Create a summary briefing from multiple data sources
 */
export function createBriefing(data: {
  breakingNews?: any[];
  trending?: any[];
  recommendations?: any[];
  date?: Date;
}): string {
  const briefingDate = data.date || new Date();
  const sections = [
    `=== Daily News Briefing ===`,
    `Date: ${briefingDate.toLocaleDateString()}`,
    `Time: ${briefingDate.toLocaleTimeString()}`,
    ''
  ];
  
  if (data.breakingNews && data.breakingNews.length > 0) {
    sections.push('📰 BREAKING NEWS');
    sections.push(formatSearchResults({ data: { items: data.breakingNews } }, { maxItems: 5 }));
    sections.push('');
  }
  
  if (data.trending && data.trending.length > 0) {
    sections.push('📈 TRENDING TOPICS');
    sections.push(formatTrendingTopics(data.trending.slice(0, 10)));
    sections.push('');
  }
  
  if (data.recommendations && data.recommendations.length > 0) {
    sections.push('💡 RECOMMENDED READING');
    sections.push(formatRecommendations(data.recommendations.slice(0, 5)));
  }
  
  return sections.join('\n');
}