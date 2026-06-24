import { gotScraping } from "got-scraping";
import UserAgent from "user-agents";

export async function postJson(url, body, token, signal) {
  const opts = {
    url,
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": new UserAgent({ deviceCategory: "mobile" }).toString(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    json: body,
    responseType: "json",
    timeout: { request: 15000 },
    retry: { limit: 0 },
  };

  if (signal instanceof AbortSignal) {
    opts.signal = signal;
  }

  return gotScraping(opts);
}
