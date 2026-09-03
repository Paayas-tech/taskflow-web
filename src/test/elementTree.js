/**
 * Helpers for inspecting the element tree returned by calling a component as a
 * plain function. Tests in this repo do not use a DOM testing library, so these
 * walk `props.children` (including arrays and fragments) instead.
 */

const isClassComponent = (type) =>
  typeof type === "function" && Boolean(type.prototype?.isReactComponent);

/** True for anything that looks like a React element. */
export function isElement(node) {
  return Boolean(node) && typeof node === "object" && !Array.isArray(node) && "props" in node;
}

/** The props of an element, or an empty object for anything else. */
export function props(node) {
  return isElement(node) ? (node.props ?? {}) : {};
}

const childrenOf = (node) => {
  const children = props(node).children;
  if (children === undefined || children === null) {
    return [];
  }
  return Array.isArray(children) ? children.flat(Infinity) : [children];
};

/** Concatenated text of a node and everything below it. */
export function textContent(node) {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(textContent).filter(Boolean).join(" ");
  }
  if (!isElement(node)) {
    return "";
  }
  return childrenOf(node).map(textContent).filter(Boolean).join(" ");
}

const walk = (node, visit, depth = 0) => {
  if (Array.isArray(node)) {
    node.flat(Infinity).forEach((child) => walk(child, visit, depth));
    return;
  }
  if (!isElement(node)) {
    return;
  }
  visit(node, depth);
  childrenOf(node).forEach((child) => walk(child, visit, depth + 1));
};

/** First element (depth-first, pre-order) matching the predicate. */
export function find(node, predicate) {
  let match;
  walk(node, (element) => {
    if (match === undefined && predicate(element)) {
      match = element;
    }
  });
  return match;
}

/** Every element matching the predicate, in depth-first order. */
export function findAll(node, predicate) {
  const matches = [];
  walk(node, (element) => {
    if (predicate(element)) {
      matches.push(element);
    }
  });
  return matches;
}

const matchesText = (value, expected) =>
  expected instanceof RegExp ? expected.test(value) : value.trim() === String(expected).trim();

/**
 * The most specific (deepest) element whose text content matches. Accepts a
 * string (compared after trimming) or a regular expression.
 */
export function findByText(node, expected) {
  let match;
  let matchDepth = -1;
  walk(node, (element, depth) => {
    if (depth > matchDepth && matchesText(textContent(element), expected)) {
      match = element;
      matchDepth = depth;
    }
  });
  return match;
}

const implicitRoles = {
  a: "link",
  article: "article",
  aside: "complementary",
  button: "button",
  h1: "heading",
  h2: "heading",
  h3: "heading",
  h4: "heading",
  h5: "heading",
  h6: "heading",
  header: "banner",
  img: "img",
  li: "listitem",
  nav: "navigation",
  ol: "list",
  section: "region",
  select: "combobox",
  textarea: "textbox",
  ul: "list",
};

const roleOf = (element) => {
  const explicit = props(element).role;
  if (explicit) {
    return explicit;
  }
  const { type } = element;
  if (typeof type !== "string") {
    return undefined;
  }
  if (type === "input") {
    const inputType = props(element).type ?? "text";
    if (inputType === "checkbox" || inputType === "radio") {
      return inputType;
    }
    return "textbox";
  }
  return implicitRoles[type];
};

const accessibleName = (element) =>
  props(element)["aria-label"] ?? props(element).label ?? textContent(element);

/**
 * First element with the given (explicit or implicit) ARIA role, optionally
 * filtered by accessible name.
 */
export function findByRole(node, role, options = {}) {
  return find(node, (element) => {
    if (roleOf(element) !== role) {
      return false;
    }
    if (options.name === undefined) {
      return true;
    }
    return matchesText(String(accessibleName(element) ?? ""), options.name);
  });
}

/**
 * Expands nested function components so compositions of primitives can be
 * asserted. `depth` counts component layers, not DOM nesting.
 */
export function render(node, depth = 6) {
  if (Array.isArray(node)) {
    return node.map((child) => render(child, depth));
  }
  if (!isElement(node)) {
    return node;
  }

  const { type } = node;
  if (typeof type === "function" && !isClassComponent(type) && depth > 0) {
    return render(type({ ...props(node) }), depth - 1);
  }

  const children = props(node).children;
  if (children === undefined) {
    return node;
  }

  return { ...node, props: { ...props(node), children: render(children, depth) } };
}
