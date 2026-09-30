/**
 * Fetch a JSON array, or throw a readable Error.
 *
 * API routes answer failures with `{ error }` (or an HTML error page), and
 * several screens used to store that object as if it were the list — then
 * crash on `.filter` / `.reduce`, or show a false "nothing here". Anything
 * that isn't a 2xx array now becomes an Error the caller can show with Retry.
 */
export async function fetchArray<T>(url: string, init?: RequestInit): Promise<T[]> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error("Couldn't reach the server. Check your connection.");
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON body (e.g. a 502 page) */
  }
  if (!res.ok) {
    const msg = body && typeof body === "object" && "error" in body ? String((body as { error: unknown }).error) : "";
    throw new Error(msg ? `The server said: ${msg}` : `The server returned an error (${res.status}).`);
  }
  if (!Array.isArray(body)) throw new Error("The server sent an unexpected response.");
  return body as T[];
}
