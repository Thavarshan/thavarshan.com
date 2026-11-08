// @vitest-environment node
import { describe, expect, it } from "vitest";
import redirect from "../../../workers/site-redirect";

describe("canonical host redirect", () => {
  it("preserves the path and query while redirecting directly to HTTPS apex", () => {
    const response = redirect.fetch(new Request("https://www.thavarshan.com/projects?ref=profile"));
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://thavarshan.com/projects?ref=profile");
  });
  it("cannot use a request host as an off-site redirect target", () => {
    const response = redirect.fetch(new Request("http://unexpected.test/a"));
    expect(response.headers.get("location")).toBe("https://thavarshan.com/a");
  });
});
