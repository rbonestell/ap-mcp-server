/**
 * Associated Press API TypeScript interfaces
 * Generated from OpenAPI schema
 */

/**
 * Base response structure for all AP API responses
 */
export interface BaseResponse {
  api_version: string;
  api_mode?: string;
  api_build?: string;
  id: string;
  method: string;
  org_name?: string;
  session_label?: string;
  params: Record<string, any>;
}

/**
 * Error response structure
 */
export interface ErrorResponse extends BaseResponse {
  error: {
    status: number;
    code: number;
    message: string;
    timestamp: string;
    item?: string;
  };
}

/**
 * Content item metadata
 */
export interface ContentItem {
  uri: string;
  altids: {
    itemid: string;
    etag?: string;
    friendlykey?: string;
    videoid?: string;
    transref?: string;
    graphicsbankid?: string;
    referenceid?: string;
  };
  foreignkeys?: Array<Record<string, string>>;
  version: number;
  type: 'text' | 'picture' | 'graphic' | 'audio' | 'video';
  profile?: string;
  urgency?: number;
  editorialpriority?: string;
  language: string;
  versioncreated: string;
  firstcreated: string;
  embargoed?: string;
  editorialrole?: string;
  fixture?: {
    name: string;
    code: string;
  };
  pubstatus: 'usable' | 'embargoed' | 'withheld' | 'canceled';
  ednote?: string;
  editorialtypes?: Array<'Add' | 'Advisory' | 'Clarification' | 'Corrective' | 'Disregard' | 'HoldForRelease' | 'Kill' | 'Lead' | 'Writethru' | 'Takes' | 'Withhold' | 'Correction' | 'Elimination'>;
  signals?: Array<'APWhollyOwned' | 'explicitcontent' | 'Test' | 'Derived' | 'DerivedLatest' | 'isnotdigitized' | 'NewsroomReady' | 'newscontent' | 'ConsumerReady' | 'singlesource' | 'whitelisted'>;
  title?: string;
  headline?: string;
  headline_extended?: string;
  headline_seo?: string;
  slugline?: string;
  description_summary?: string;
  bylines?: Array<{
    code?: string;
    parametric?: string;
    by: string;
    title?: string;
  }>;
  producer?: {
    name: string;
  };
  photographer?: {
    code?: string;
    name: string;
    title?: string;
  };
  located?: string;
  datelinelocation?: {
    city?: string;
    countrycode?: string;
    countryname?: string;
    countryareacode?: string;
    countryareaname?: string;
    geometry_geojson?: {
      type: 'Point';
      coordinates: [number, number];
    };
  };
  copyrightnotice?: string;
  usageterms?: string[];
  keywords?: string[];
  outcue?: string;
  provider?: string;
  infosource?: Array<{
    name: string;
    type?: string;
  }>;
  links?: Array<{
    href: string;
    rel: string;
  }>;
  person?: Array<{
    code?: string;
    name: string;
    creator: string;
    rels: Array<'direct' | 'personfeatured'>;
    associatedstates?: Array<{
      code: string;
      name: string;
    }>;
    associatedevents?: Array<{
      code: string;
      name: string;
    }>;
    teams?: Array<{
      code: string;
      name: string;
    }>;
    scheme?: string;
    types?: string[];
  }>;
  subject?: Array<{
    code: string;
    name: string;
    parentids?: string[];
    rels: Array<'direct' | 'ancestor' | 'inferred' | 'category' | 'suppcategory'>;
    creator: 'Editorial' | 'Machine';
    topparent?: boolean;
    scheme: string;
  }>;
  organisation?: Array<{
    industries?: Array<{
      code: string;
      name: string;
    }>;
    code: string;
    name: string;
    parentids?: string[];
    rels: string[];
    creator: 'Editorial' | 'Machine';
    symbols?: Array<{
      instrument: string;
      ticker: string;
      exchange: string;
    }>;
    topparent?: boolean;
    scheme: string;
  }>;
  place?: Array<{
    code: string;
    name: string;
    parentids?: string[];
    rels: Array<'direct' | 'ancestor'>;
    locationtype: {
      code: string;
      name: string;
    };
    creator: 'Editorial' | 'Machine';
    topparent?: boolean;
    scheme: string;
    geometry_geojson?: {
      type: 'Point';
      coordinates: [number, number];
    };
  }>;
  event?: Array<Record<string, any>>;
  audiences?: Array<{
    code: string;
    name: string;
    type: string;
  }>;
  description_caption?: string;
  description_creditline?: string;
  description_editornotes?: string;
  textformat?: string;
  associations?: Record<string, {
    headline?: string;
    altids: {
      itemid: string;
      etag: string;
    };
    type: 'text' | 'picture' | 'graphic' | 'audio' | 'video';
    uri: string;
  }>;
  renditions?: Record<string, {
    orientation?: 'Horizontal' | 'Vertical';
    scene?: string;
    height?: number;
    href: string;
    duration?: number;
    samplerate?: string;
    digest?: string;
    sizeinbytes?: number;
    title?: string;
    averagebitrate?: string;
    width?: number;
    rel: 'Main' | 'Preview' | 'Thumbnail' | 'Caption' | 'Script' | 'Shotlist';
    videoscaling?: 'pillarboxed' | 'letterboxed' | 'mixed' | 'original';
    contentid?: string;
    type: 'text' | 'picture' | 'graphic' | 'audio' | 'video';
    videocodec?: string;
    format?: string;
    words?: number;
    fileextension?: string;
    mediafilterid?: string;
    aspectratio?: '16:9' | '4:3';
    originalfilename?: string;
    mimetype?: string;
    framerate?: number;
    colourspace?: 'Color' | 'Black and White' | 'RGB' | 'Greyscale';
    backgroundcolour?: string;
    resolution?: number;
    version_links?: string[];
  }>;
}

/**
 * Content result with metadata
 */
export interface ContentResult {
  meta?: {
    score?: number;
    products?: Array<{
      id: number;
      name: string;
    }>;
    followed_topics?: Array<{
      id: number;
      name: string;
    }>;
    pricing?: {
      amount?: number | null;
      currency?: string | null;
      formatted?: string | null;
      apusecode?: number;
      tier?: string;
      message: string;
      policy: {
        policytype: string;
        policyid: string;
        permissions?: Array<{
          target: string;
          action: string;
          assigner: string;
          constraints: Array<{
            operator: string;
            rightoperand: string;
            name: string;
          }>;
          duties: Array<{
            action: string;
            constraints?: Array<{
              operator: string;
              rightoperand: string;
              rightoperandunit: string;
              name: string;
              rightoperanddatatype: string;
            }>;
          }>;
        }>;
        prohibitions?: Array<{
          target: string;
          action: string;
          assigner: string;
        }>;
      };
    };
  };
  item: ContentItem;
}

/**
 * Content response for single item
 */
export interface ContentResponse extends BaseResponse {
  data: ContentResult;
}

/**
 * Search response with pagination
 */
export interface SearchResponse extends BaseResponse {
  data: {
    query?: string;
    updated: string;
    page_size: number;
    total_items: number;
    current_page: number;
    current_item_count: number;
    next_page?: string;
    previous_page?: string;
    page_template?: string;
    feed_href?: string;
    items: ContentResult[];
  };
}

/**
 * Feed response structure
 */
export interface FeedResponse extends BaseResponse {
  data: {
    query?: string;
    updated: string;
    total_items: number;
    current_page: number;
    page_size: number;
    current_item_count: number;
    next_page?: string;
    previous_page?: string;
    page_template?: string;
    items: ContentResult[];
  };
}

/**
 * RSS response structure
 */
export interface RSSResponse {
  rss: {
    version: string;
    channel: {
      title: string;
      description: string;
      link: string;
    };
  };
}

/**
 * Account response structure
 */
export interface AccountResponse extends BaseResponse {
  data: {
    id: string;
    title: string;
    updated: string;
    links: Array<{
      title: string;
      url: string;
      description: string;
    }>;
  };
}

/**
 * Account plans response
 */
export interface AccountPlansResponse extends BaseResponse {
  data: {
    id: string;
    title: string;
    updated: string;
    plans: Array<{
      id: number;
      name: string;
      updated: string;
      plan_style: 'percent' | 'downloads' | 'duration';
      duration?: string;
      used: number;
      usage_limit: number;
      interval: string;
      next_cycle_begins: string;
      entitlements: Array<{
        id: number;
        parent_id?: number;
        name: string;
        tier: string;
        type: 'Package' | 'Product';
        meter_ticks: number;
        base_cost: number;
        overage_allowed: boolean;
        overage_cost: number;
        currency: string;
        daypart?: {
          id: number;
          type: string;
        };
        search_link?: string;
        feed_link?: string;
      }>;
    }>;
  };
}

/**
 * Account downloads response
 */
export interface AccountDownloadsResponse extends BaseResponse {
  data: {
    id: string;
    title: string;
    updated: string;
    total_items: number;
    current_item_count: number;
    min_date: string;
    max_date: string;
    downloads: Array<{
      id: string;
      item: {
        id: string;
        type: 'Picture' | 'Text' | 'Audio' | 'Video' | 'Photo' | 'Graphic' | 'Graphics Bank' | 'Complexdata' | 'Composite' | 'Print Graphics' | 'Unknown';
        friendlykey: string;
        title: string;
        source: string;
      };
      org_name: string;
      downloaded_by: string;
      download_date: string;
      duplicate: boolean;
      charge: number;
      currency: string;
    }>;
  };
}

/**
 * Account quotas response
 */
export interface AccountQuotasResponse extends BaseResponse {
  data: {
    id: string;
    title: string;
    account: string;
    updated: string;
    quotas: Array<{
      method: 'content' | 'search' | 'feed' | 'account' | 'plans' | 'downloads' | 'quotas' | 'other';
      limit: number;
      period: string;
    }>;
  };
}

/**
 * Monitor definition for creating/updating monitors
 */
export interface Monitor {
  name: string;
  description?: string;
  playbook?: string;
  repeatAlerts?: string;
  notify: Array<{
    channelType: 'email';
    channelDestinations: string[];
  }>;
  conditions: Array<{
    type: 'idleFeed' | 'quality';
    enabled: boolean;
    criteria: {
      idleTime?: string;
    };
  }>;
}

/**
 * Monitors response
 */
export interface MonitorsResponse extends BaseResponse {
  data: Record<string, any>;
}

/**
 * Query parameters for content search
 */
export interface SearchParams {
  q?: string;
  include?: string[];
  exclude?: string[];
  sort?: string;
  page?: string;
  page_size?: number;
  pricing?: boolean;
  in_my_plan?: boolean;
  session_label?: string;
}

/**
 * Query parameters for content feed
 */
export interface FeedParams {
  q?: string;
  include?: string[];
  exclude?: string[];
  page_size?: number;
  pricing?: boolean;
  in_my_plan?: boolean;
  with_monitor?: string;
  session_label?: string;
  filter_out?: string;
}

/**
 * Query parameters for single item
 */
export interface ItemParams {
  include?: string[];
  exclude?: string[];
  pricing?: boolean;
  in_my_plan?: boolean;
  format?: string;
}

/**
 * Query parameters for RSS feeds
 */
export interface RSSParams {
  include?: string[];
  exclude?: string[];
  page_size?: number;
}

/**
 * Query parameters for account downloads
 */
export interface DownloadsParams {
  include?: string[];
  exclude?: string[];
  min_date?: string;
  max_date?: string;
  order?: number;
  format?: 'json' | 'csv';
}

/**
 * API configuration interface
 */
export interface APConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  retries?: number;
}