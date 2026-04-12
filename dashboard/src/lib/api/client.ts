import axios from "axios";
import { createBrowserClient } from "@/lib/supabase/client";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_OPENJCK_API_URL,
});

// Auth interceptor — attach JWT from Supabase session
apiClient.interceptors.request.use(async (config) => {
  const supabase = createBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

export default apiClient;
