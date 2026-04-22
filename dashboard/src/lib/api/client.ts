import axios, { AxiosError } from "axios";
import { createBrowserClient } from "@/lib/supabase/client";
import { handleApiError } from "./error-handler";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_OPENJCK_API_URL,
  timeout: 30000, // 30 second default timeout
});

// Auth interceptor — attach JWT from Supabase session
apiClient.interceptors.request.use(async (config) => {
  const supabase = createBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Error response interceptor — handle API errors globally
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Skip toast for auth errors on the login page
    const isAuthPage = typeof window !== "undefined" &&
      (window.location.pathname === "/login" ||
       window.location.pathname.startsWith("/auth/"));

    if (isAuthPage && error.response?.status === 401) {
      return Promise.reject(error);
    }

    // Handle the error
    handleApiError(error);

    return Promise.reject(error);
  }
);

export default apiClient;
