export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

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