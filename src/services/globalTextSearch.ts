export type GlobalTextResult = {
  id: string;
  route: string;
  page: string;
  excerpt: string;
  occurrence: number;
};

export type GlobalTextSearchState = {
  query: string;
  results: GlobalTextResult[];
  selectedIndex: number;
  isIndexing: boolean;
  indexedPages: number;
  totalPages: number;
  failedPages: string[];
  isOpen: boolean;
};

type IndexedPage = {
  route: string;
  page: string;
  text: string;
};

type TextSegment = {
  node: Text;
  start: number;
  end: number;
};

type FlattenedText = {
  text: string;
  segments: TextSegment[];
};

const SEARCH_PAGES = [
  { route: "home", page: "Home" },
  { route: "schedule", page: "Schedule" },
  { route: "insights", page: "Insights" },
  { route: "community", page: "Community" },
  { route: "create", page: "Create" },
  { route: "channels", page: "Channels" },
  { route: "template", page: "Templates" },
  { route: "integrations", page: "Integrations" },
  { route: "settings", page: "Settings" },
  { route: "pricing", page: "Pricing" },
  { route: "faq", page: "FAQ" },
  { route: "tos", page: "Terms of Service" },
  { route: "privacy", page: "Privacy" },
] as const;

const BLOCK_TAGS = new Set([
  "ADDRESS",
  "ARTICLE",
  "ASIDE",
  "BLOCKQUOTE",
  "DIV",
  "DL",
  "DT",
  "DD",
  "FIELDSET",
  "FIGCAPTION",
  "FIGURE",
  "FOOTER",
  "FORM",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HEADER",
  "LI",
  "MAIN",
  "NAV",
  "OL",
  "P",
  "SECTION",
  "TABLE",
  "TD",
  "TH",
  "TR",
  "UL",
]);

const INITIAL_STATE: GlobalTextSearchState = {
  query: "",
  results: [],
  selectedIndex: 0,
  isIndexing: false,
  indexedPages: 0,
  totalPages: SEARCH_PAGES.length,
  failedPages: [],
  isOpen: false,
};

let state = INITIAL_STATE;
let pageIndex: IndexedPage[] | null = null;
let indexPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function subscribeToGlobalTextSearch(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getGlobalTextSearchState() {
  return state;
}

function publish(patch: Partial<GlobalTextSearchState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function normalizedQuery(query: string) {
  return query.trim().toLocaleLowerCase();
}

function isIgnoredText(node: Text) {
  const parent = node.parentElement;
  return (
    !parent ||
    !node.data.trim() ||
    Boolean(
      parent.closest(
        'script,style,noscript,svg,[aria-hidden="true"],[data-global-search-ignore],input,textarea,select,option'
      )
    )
  );
}

function blockAncestor(node: Text, root: Element): Element {
  let element = node.parentElement;
  while (element && element !== root && !BLOCK_TAGS.has(element.tagName)) {
    element = element.parentElement;
  }
  return element ?? root;
}

function flattenText(root: Element): FlattenedText {
  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT
  );
  const segments: TextSegment[] = [];
  let text = "";
  let previousBlock: Element | null = null;
  let current = walker.nextNode();

  while (current) {
    const node = current as Text;
    if (!isIgnoredText(node)) {
      const block = blockAncestor(node, root);
      if (
        previousBlock &&
        block !== previousBlock &&
        text.length > 0 &&
        !/\s$/.test(text)
      ) {
        text += " ";
      }

      const start = text.length;
      text += node.data;
      segments.push({ node, start, end: text.length });
      previousBlock = block;
    }
    current = walker.nextNode();
  }

  return { text, segments };
}

function getSearchRoot(doc: Document): Element {
  return doc.querySelector("main") ?? doc.body;
}

function getTextForRoute(doc: Document) {
  return flattenText(getSearchRoot(doc)).text;
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

async function waitForRouteText(
  frame: HTMLIFrameElement,
  route: string
): Promise<string> {
  let previousText = "";
  let stableSamples = 0;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const doc = frame.contentDocument;
    if (doc?.documentElement.dataset.appRoute === route) {
      const text = getTextForRoute(doc);
      if (text && text === previousText) stableSamples += 1;
      else stableSamples = 0;

      if (text && stableSamples >= 2) return text;
      previousText = text;
    }
    await wait(60);
  }

  return "";
}

function setFrameRoute(frame: HTMLIFrameElement, route: string) {
  const frameWindow = frame.contentWindow;
  if (!frameWindow) return;

  const nextUrl = `${frameWindow.location.pathname}${frameWindow.location.search}#/${route}`;
  frameWindow.history.replaceState({}, "", nextUrl);
  frameWindow.dispatchEvent(new frameWindow.Event("popstate"));
}

async function buildPageIndex(): Promise<IndexedPage[]> {
  const frame = document.createElement("iframe");
  frame.title = "Global search text index";
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText =
    "position:fixed;left:-12000px;top:0;width:1024px;height:768px;border:0;opacity:0;pointer-events:none";

  const startUrl = new URL(window.location.href);
  startUrl.search = "";
  startUrl.hash = "#/faq";

  const loaded = new Promise<void>((resolve, reject) => {
    frame.onload = () => resolve();
    frame.onerror = () => reject(new Error("Unable to load app search index"));
  });

  document.body.appendChild(frame);
  frame.src = startUrl.href;

  try {
    await loaded;
    const pages: IndexedPage[] = [];
    const failedPages: string[] = [];

    for (const page of SEARCH_PAGES) {
      if (frame.contentDocument?.documentElement.dataset.appRoute !== page.route) {
        setFrameRoute(frame, page.route);
      }

      const text = await waitForRouteText(frame, page.route);
      if (!text) {
        failedPages.push(page.page);
        continue;
      }

      pages.push({ ...page, text });
      publish({ indexedPages: pages.length, failedPages });
    }

    if (pages.length === 0) throw new Error("No app pages could be indexed");
    return pages;
  } finally {
    frame.remove();
  }
}

function createResults(pages: IndexedPage[], query: string) {
  const needle = normalizedQuery(query);
  if (!needle) return [];

  const results: GlobalTextResult[] = [];
  for (const page of pages) {
    const loweredText = page.text.toLocaleLowerCase();
    let occurrence = 0;
    let offset = loweredText.indexOf(needle);

    while (offset !== -1) {
      const excerptStart = Math.max(0, offset - 64);
      const excerptEnd = Math.min(page.text.length, offset + needle.length + 72);
      const excerpt = page.text
        .slice(excerptStart, excerptEnd)
        .replace(/\s+/g, " ")
        .trim();

      results.push({
        id: `${page.route}:${occurrence}`,
        route: page.route,
        page: page.page,
        excerpt: `${excerptStart > 0 ? "..." : ""}${excerpt}${excerptEnd < page.text.length ? "..." : ""}`,
        occurrence,
      });

      occurrence += 1;
      offset = loweredText.indexOf(needle, offset + needle.length);
    }
  }

  return results;
}

function refreshResults() {
  if (!pageIndex) return;
  const results = createResults(pageIndex, state.query);
  publish({ results, selectedIndex: Math.min(state.selectedIndex, Math.max(0, results.length - 1)) });
}

export function setGlobalTextSearchQuery(query: string) {
  publish({ query, selectedIndex: 0 });
  if (!query.trim()) {
    publish({ results: [], indexedPages: pageIndex?.length ?? 0, failedPages: [] });
    clearGlobalTextHighlights(document);
    return;
  }

  if (pageIndex) {
    refreshResults();
    return;
  }

  if (indexPromise) return;

  publish({ isIndexing: true, indexedPages: 0, failedPages: [] });
  indexPromise = buildPageIndex()
    .then((pages) => {
      pageIndex = pages;
      refreshResults();
    })
    .catch(() => {
      publish({ failedPages: SEARCH_PAGES.map((page) => page.page) });
    })
    .finally(() => {
      indexPromise = null;
      publish({ isIndexing: false });
    });
}

export function setGlobalTextSearchOpen(isOpen: boolean) {
  publish({ isOpen });
}

export function setGlobalTextSearchSelection(selectedIndex: number) {
  if (state.results.length === 0) return;
  const wrappedIndex =
    (selectedIndex + state.results.length) % state.results.length;
  publish({ selectedIndex: wrappedIndex });
}

function getHighlightRegistry(doc: Document) {
  const view = doc.defaultView as (Window & {
    CSS?: { highlights?: { set: (name: string, value: unknown) => void; delete: (name: string) => void } };
    Highlight?: new (...ranges: Range[]) => unknown;
  }) | null;

  return {
    registry: view?.CSS?.highlights,
    HighlightConstructor: view?.Highlight,
  };
}

export function clearGlobalTextHighlights(doc: Document) {
  const registry = getHighlightRegistry(doc).registry;
  registry?.delete("global-search-hit");
  registry?.delete("global-search-active");
}

function findRanges(flattened: FlattenedText, query: string) {
  const needle = normalizedQuery(query);
  const lowerText = flattened.text.toLocaleLowerCase();
  const ranges: Range[] = [];
  if (!needle) return ranges;

  let offset = lowerText.indexOf(needle);
  while (offset !== -1) {
    const endOffset = offset + needle.length;
    const startSegment = flattened.segments.find(
      (segment) => segment.start <= offset && offset < segment.end
    );
    const endSegment = flattened.segments.find(
      (segment) => segment.start < endOffset && endOffset <= segment.end
    );

    if (startSegment && endSegment) {
      const range = startSegment.node.ownerDocument.createRange();
      range.setStart(startSegment.node, offset - startSegment.start);
      range.setEnd(endSegment.node, endOffset - endSegment.start);
      ranges.push(range);
    }

    offset = lowerText.indexOf(needle, offset + needle.length);
  }
  return ranges;
}

export function highlightGlobalText(
  doc: Document,
  query: string,
  activeOccurrence: number
) {
  clearGlobalTextHighlights(doc);
  if (!query.trim()) return;

  const { registry, HighlightConstructor } = getHighlightRegistry(doc);
  if (!registry || !HighlightConstructor) return;

  const ranges = findRanges(flattenText(getSearchRoot(doc)), query);
  if (ranges.length === 0) return;

  registry.set("global-search-hit", new HighlightConstructor(...ranges));
  const activeRange = ranges[activeOccurrence];
  if (activeRange) {
    registry.set(
      "global-search-active",
      new HighlightConstructor(activeRange)
    );
    activeRange.startContainer.parentElement?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }
}