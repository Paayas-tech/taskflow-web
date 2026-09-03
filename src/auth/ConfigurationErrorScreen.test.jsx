import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { findByRole, findByText, render } from "../test/elementTree";
import ConfigurationErrorScreen, {
  CONFIGURATION_ERROR_MESSAGE,
} from "./ConfigurationErrorScreen";

describe("configuration error screen", () => {
  it("renders only generic guidance and no supplied configuration values", () => {
    const secretUrl = "https://private-project.supabase.co";
    const secretKey = "sb_publishable_do-not-render";
    const markup = renderToStaticMarkup(
      <ConfigurationErrorScreen onRetry={() => {}} />
    );

    expect(markup).toContain(CONFIGURATION_ERROR_MESSAGE);
    expect(markup).toContain("Retry");
    expect(markup).not.toContain(secretUrl);
    expect(markup).not.toContain(secretKey);
    expect(markup).not.toMatch(/VITE_SUPABASE|anon key/i);
  });

  it("announces the failure and retries on request", () => {
    const onRetry = vi.fn();
    const tree = render(ConfigurationErrorScreen({ onRetry }));

    expect(findByRole(tree, "alert")).toBeDefined();
    findByText(tree, "Retry").props.onClick();

    expect(onRetry).toHaveBeenCalledOnce();
  });
});
