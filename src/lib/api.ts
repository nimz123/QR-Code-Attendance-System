/**
 * Helper function for handling API requests with automatic JWT token attachment
 * and relative path resolution through the Vite proxy/Render server.
 */
export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  // Retrieve the stored JWT authentication token
  const token = localStorage.getItem('token');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  // Attach Authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    // Safely parse JSON response
    const data = await response.json().catch(() => ({}));
    
    return { 
      ok: response.ok, 
      status: response.status, 
      data 
    };
  } catch (error) {
    console.error('🔥 API fetch network error:', error);
    return { 
      ok: false, 
      status: 500, 
      data: { success: false, error: 'Network error: Unable to connect to server.' } 
    };
  }
}