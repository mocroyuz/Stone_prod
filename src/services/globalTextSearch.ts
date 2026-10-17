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
  selectedResultId: string | null;
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
  source: "static" | "rendered";
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
  selectedResultId: null,
  isIndexing: false,
  indexedPages: 0,
  totalPages: 0,
  failedPages: [],
  isOpen: false,
};

let state = INITIAL_STATE;
const pageIndex = new Map<string, IndexedPage>();
const listeners = new Set<() => void>();

export function subscribeToGlobalTextSearch(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getGlobalTextSearchState() {
  return state;
}

function registerPageText(
  route: string,
  page: string,
  text: string,
  source: IndexedPage["source"]
) {
  const previous = pageIndex.get(route);
  if (previous?.source === "rendered" && source === "static") return;
  if (previous?.source === source && previous.text === text) return;

  pageIndex.set(route, { route, page, text, source });
  publish({ indexedPages: pageIndex.size, totalPages: pageIndex.size });
  refreshResults();
}

export function registerGlobalSearchPage(
  route: string,
  page: string,
  text: string
) {
  registerPageText(route, page, text, "static");
}

export function registerRenderedGlobalSearchPage(
  route: string,
  text: string
) {
  const normalizedRoute = route === "calendar" ? "schedule" : route;
  const page = pageIndex.get(normalizedRoute)?.page ?? normalizedRoute;
  registerPageText(normalizedRoute, page, text, "rendered");
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

export function getGlobalSearchTextFromDocument(doc: Document) {
  return flattenText(getSearchRoot(doc)).text;
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
  const results = createResults(Array.from(pageIndex.values()), state.query);
  const matchingSelection = state.selectedResultId
    ? results.findIndex((result) => result.id === state.selectedResultId)
    : -1;
  const selectedIndex =
    matchingSelection >= 0
      ? matchingSelection
      : Math.min(state.selectedIndex, Math.max(0, results.length - 1));
  publish({
    results,
    selectedIndex,
    selectedResultId: results[selectedIndex]?.id ?? null,
    failedPages: [],
  });
}

export function setGlobalTextSearchQuery(query: string) {
  publish({ query, selectedIndex: 0, selectedResultId: null });
  if (!query.trim()) {
    publish({ results: [], selectedResultId: null, failedPages: [] });
    clearGlobalTextHighlights(document);
    return;
  }
  refreshResults();
}

export function setGlobalTextSearchOpen(isOpen: boolean) {
  publish({ isOpen });
}

export function setGlobalTextSearchSelection(selectedIndex: number) {
  if (state.results.length === 0) return;
  const wrappedIndex =
    (selectedIndex + state.results.length) % state.results.length;
  publish({
    selectedIndex: wrappedIndex,
    selectedResultId: state.results[wrappedIndex].id,
  });
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