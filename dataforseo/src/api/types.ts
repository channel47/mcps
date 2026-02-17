export interface DataForSeoResponse<T> {
  version: string;
  status_code: number;
  status_message: string;
  time: string;
  cost: number;
  tasks_count: number;
  tasks_error: number;
  tasks: T[];
}

export interface DataForSeoTask<T> {
  id: string;
  status_code: number;
  status_message: string;
  time: string;
  cost: number;
  result_count: number;
  path: string[];
  data: any;
  result: T[];
}

export interface DataForSeoErrorResponse {
  version: string;
  status_code: number;
  status_message: string;
  time: string;
}

// Common interfaces for task operations
export interface TaskPostResponse<T = any> {
  id: string;
  status_code: number;
  status_message: string;
  time: string;
  cost: number;
  result_count: number;
  path: string[];
  data: T;
  result: null;
}

export interface TaskReadyResponse {
  id: string;
  status_code: number;
  status_message: string;
  time: string;
}

export interface TaskGetResponse<T = any> {
  id: string;
  status_code: number;
  status_message: string;
  time: string;
  cost: number;
  result_count: number;
  path: string[];
  data: any;
  result: T[];
}

// Common parameters for API calls
export interface LocationParameters {
  location_name?: string;
  location_code?: number;
  language_name?: string;
  language_code?: string;
}

export interface PaginationParameters {
  limit?: number;
  offset?: number;
}

export interface DateRangeParameters {
  date_from?: string;
  date_to?: string;
}

export interface TaskParameters {
  tag?: string;
  priority?: number;
  postback_url?: string;
  postback_data?: string;
}

// Status codes and messages
export enum StatusCode {
  SUCCESS = 20000,
  TASK_CREATED = 20100,
  NO_RESULTS = 20011,
  ERROR = 40000,
  AUTH_ERROR = 40100,
  INVALID_PARAMETERS = 40200
}

// API Methods
export enum ApiMethod {
  TASK_POST = 'task_post',
  TASKS_READY = 'tasks_ready',
  TASK_GET = 'task_get',
  LIVE = 'live'
}