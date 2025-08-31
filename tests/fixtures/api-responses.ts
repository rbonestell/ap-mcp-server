/**
 * Mock API response fixtures for testing
 * Based on AP Media API v2 response formats
 */

export const mockSearchResponse = {
  data: {
    items: [
      {
        uri: "tag:ap.org:2024:123456",
        altids: {
          itemid: "123456"
        },
        version: "1",
        headline: "Test News Article",
        firstcreated: "2024-01-15T10:30:00Z",
        versioncreated: "2024-01-15T10:30:00Z",
        type: "text",
        language: "en",
        urgency: 3,
        priority: 3,
        subject: [
          {
            code: "04000000",
            name: "economy, business and finance"
          }
        ],
        byline: "By TEST REPORTER",
        dateline: "NEW YORK",
        body_text: "This is a test news article body...",
        word_count: 250
      }
    ],
    next_page: "next_token_123"
  }
};

export const mockContentItem = {
  data: {
    item: {
      uri: "tag:ap.org:2024:123456",
      altids: {
        itemid: "123456"
      },
      version: "1",
      headline: "Test News Article",
      firstcreated: "2024-01-15T10:30:00Z",
      versioncreated: "2024-01-15T10:30:00Z",
      type: "text",
      language: "en",
      urgency: 3,
      priority: 3,
      subject: [
        {
          code: "04000000",
          name: "economy, business and finance"
        }
      ],
      byline: "By TEST REPORTER",
      dateline: "NEW YORK",
      body_text: "This is a test news article body...",
      word_count: 250,
      associations: {
        main: {
          type: "picture",
          uri: "tag:ap.org:2024:photo123",
          headline: "Test Photo",
          description_text: "Test photo description"
        }
      }
    }
  }
};

export const mockAccountInfo = {
  data: {
    account: {
      id: "test_account_id",
      name: "Test Account",
      type: "premium",
      status: "active",
      created: "2023-01-01T00:00:00Z"
    }
  }
};

export const mockAccountPlans = {
  data: {
    plans: [
      {
        id: "plan_123",
        name: "Premium Plan",
        type: "subscription",
        status: "active",
        entitlements: [
          {
            name: "text_downloads",
            limit: 10000,
            used: 250,
            reset_date: "2024-02-01T00:00:00Z"
          }
        ]
      }
    ]
  }
};

export const mockDownloads = {
  data: {
    downloads: [
      {
        id: "download_123",
        item_uri: "tag:ap.org:2024:123456",
        downloaded_at: "2024-01-15T10:30:00Z",
        format: "nitf",
        size_bytes: 1024
      }
    ],
    pagination: {
      total: 1,
      page: 1,
      per_page: 50
    }
  }
};

export const mockRSSFeeds = {
  data: {
    feeds: [
      {
        id: "feed_123",
        name: "Business News",
        description: "Latest business news",
        url: "https://ap.org/rss/business.xml",
        category: "business",
        updated: "2024-01-15T10:30:00Z"
      }
    ]
  }
};

export const mockMonitors = {
  data: {
    monitors: [
      {
        id: "monitor_123",
        name: "Tech News Monitor",
        query: "technology AND innovation",
        status: "active",
        created: "2024-01-01T00:00:00Z",
        last_triggered: "2024-01-15T10:30:00Z"
      }
    ]
  }
};

export const mockAPIError = {
  error: {
    code: "INVALID_PARAMETER",
    message: "The parameter 'q' is required for search operations",
    details: {
      parameter: "q",
      expected_type: "string"
    }
  }
};

export const mockRateLimitError = {
  error: {
    code: "RATE_LIMIT_EXCEEDED",
    message: "API rate limit exceeded. Please retry after the specified time.",
    details: {
      retry_after: 60,
      limit: 100,
      remaining: 0,
      reset_time: "2024-01-15T11:00:00Z"
    }
  }
};

export const mockUnauthorizedError = {
  error: {
    code: "UNAUTHORIZED",
    message: "Invalid API key provided",
    details: {
      hint: "Check your API key configuration"
    }
  }
};

// Helper function to create paginated responses
export const createPaginatedResponse = (items: any[], page = 1, perPage = 50, total?: number) => {
  const totalItems = total ?? items.length;
  const hasNext = page * perPage < totalItems;
  
  return {
    data: {
      items: items.slice((page - 1) * perPage, page * perPage),
      pagination: {
        page,
        per_page: perPage,
        total: totalItems,
        ...(hasNext && { next_page: `page_${page + 1}` })
      }
    }
  };
};

// Helper function to create error responses
export const createErrorResponse = (code: string, message: string, status = 400) => {
  return {
    error: {
      code,
      message,
      status
    }
  };
};