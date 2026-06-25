import { gotScraping } from "got-scraping";
import UserAgent from "user-agents";

const ua = new UserAgent({ deviceCategory: "mobile" });

export function postJson(url, body, token, signal) {
  const opts = {
    url,
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": ua.toString(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    json: body,
    responseType: "json",
    timeout: { request: 15_000 },
    retry: { limit: 0 },
  };

  if (signal instanceof AbortSignal) {
    opts.signal = signal;
  }

  return gotScraping(opts);
}