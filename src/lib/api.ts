export class ApiError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new ApiError(typeof data.code === "string" ? data.code : "SERVER_ERROR", response.status);
  return data;
}
