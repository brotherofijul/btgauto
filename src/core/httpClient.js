import { gotScraping } from "got-scraping";
import UserAgent from "user-agents";

export async function postJson(url, body, token, signal) {
  const userAgent = new UserAgent({ deviceCategory: "mobile" }).toString();
  return gotScraping({
    url,
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": userAgent,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    json: body,
    responseType: "json",
    timeout: { request: 15000 },
    retry: { limit: 0 },
    signal,
  });
}
