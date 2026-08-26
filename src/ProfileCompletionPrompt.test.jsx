import { describe, expect, it, vi } from "vitest";
import ProfileCompletionPrompt from "./ProfileCompletionPrompt";

const childrenOf = (node) => {
  const children = node?.props?.children;
  return (Array.isArray(children) ? children : [children]).filter(
    (child) => child !== null && child !== undefined && child !== false
  );
};

const walk = (node, visitor) => {
  if (Array.isArray(node)) {
    node.forEach((child) => walk(child, visitor));
    return;
  }
  if (!node || typeof node !== "object") return;
  visitor(node);
  childrenOf(node).forEach((child) => walk(child, visitor));
};

const textContent = (node) => {
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  return childrenOf(node).map(textContent).join("");
};

const findButton = (root, label) => {
  let match;
  walk(root, (node) => {
    if (!match && node.type === "button" && textContent(node) === label) match = node;
  });
  return match;
};

describe("ProfileCompletionPrompt", () => {
  it.each(["Existing User", "New Signup User"])(
    "does not render for a user with the saved display name %s",
    (displayName) => {
      expect(ProfileCompletionPrompt({ displayName })).toBeNull();
    }
  );

  it("offers the existing profile flow for a missing name without exposing an ID", () => {
    const onOpenProfile = vi.fn();
    const userId = "11111111-1111-4111-8111-111111111111";
    const output = ProfileCompletionPrompt({
      displayName: "",
      onOpenProfile,
      onDismiss: vi.fn(),
    });

    expect(textContent(output)).toContain("TaskFlow user");
    expect(textContent(output)).not.toContain(userId);
    findButton(output, "Add display name").props.onClick();
    expect(onOpenProfile).toHaveBeenCalledOnce();
  });

  it("dismisses without blocking use and disappears after a name is saved", () => {
    const onDismiss = vi.fn();
    const output = ProfileCompletionPrompt({
      displayName: " ",
      onOpenProfile: vi.fn(),
      onDismiss,
    });

    findButton(output, "Not now").props.onClick();
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(ProfileCompletionPrompt({ displayName: "Saved Name" })).toBeNull();
  });
});
