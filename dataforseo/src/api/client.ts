import axios, { AxiosInstance } from 'axios';

export interface DataForSeoClient {
  login: string;
  password: string;
  baseUrl: string;
  httpClient: AxiosInstance;
  get: <T>(url: string) => Promise<T>;
  post: <T>(url: string, data: any) => Promise<T>;
}

export function setupApiClient(login: string, password: string): DataForSeoClient {
  const baseUrl = 'https://api.dataforseo.com/v3';
  
  // Create an Axios instance with authentication
  const httpClient = axios.create({
    baseURL: baseUrl,
    auth: {
      username: login,
      password: password
    },
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  // Create the client interface
  const client: DataForSeoClient = {
    login,
    password,
    baseUrl,
    httpClient,
    
    async get<T>(url: string): Promise<T> {
      try {
        const response = await httpClient.get(url);
        return response.data as T;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.error(`DataForSEO API GET error (${url}):`, error.response?.data || error.message);
        } else {
          console.error(`DataForSEO API GET error (${url}):`, error);
        }
        throw error;
      }
    },
    
    async post<T>(url: string, data: any): Promise<T> {
      try {
        const response = await httpClient.post(url, data);
        return response.data as T;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.error(`DataForSEO API POST error (${url}):`, error.response?.data || error.message);
        } else {
          console.error(`DataForSEO API POST error (${url}):`, error);
        }
        throw error;
      }
    }
  };
  
  return client;
}