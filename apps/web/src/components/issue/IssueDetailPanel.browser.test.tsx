import {
  EnvironmentId,
  IssueTrackerKind,
  ProjectId,
  ThreadId,
  type IssueDetail,
  type ScopedThreadRef,
} from "@t3tools/contracts";
import { expect, it, vi } from "vite-plus/test";

const url = "https://github.com/owner/repo/issues/7";

const state = vi.hoisted(() => ({
  detail: null as unknown,
  openLink: vi.fn((_url: string, _options?: { readonly event?: unknown }): Promise<void> =>
    Promise.resolve(),
  ),
}));

vi.mock(import("~/state/query"), async (original) => ({
  ...(await original()),
  useEnvironmentQuery: (() => ({
    data: state.detail,
    dataUpdatedAt: 0,
    error: null,
    failure: null,
    isPending: false,
    isSuccess: true,
    refresh: () => undefined,
  })) as never,
}));
vi.mock(import("~/browser/useOpenLink"), () => ({
  useOpenLink: () => (link, options) => state.openLink(link, options),
}));
vi.mock(import("./IssueThreadLinks"), () => ({ IssueThreadLinks: () => <></> }));

import { render } from "../../../test/render";
import { IssueDetailPanel } from "./IssueDetailPanel";

const environmentId = EnvironmentId.make("environment");
const threadRef: ScopedThreadRef = { environmentId, threadId: ThreadId.make("thread") };

const detail: IssueDetail = {
  tracker: IssueTrackerKind.make("github"),
  host: "github.com",
  scope: "owner/repo",
  key: "7",
  displayKey: "#7",
  title: "Links open in the wrong browser",
  url,
  author: null,
  state: { category: "open", name: "Open" },
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
  closedAt: null,
  assignees: [],
  labels: [],
  commentCount: 0,
  projectId: ProjectId.make("project"),
  projectTitle: "Project",
  writable: false,
  capabilities: {
    create: false,
    edit: false,
    comment: false,
    labels: false,
    assignees: false,
    reactions: false,
    templates: false,
    linkedPullRequests: false,
    events: false,
    search: false,
  },
  viewerPermissions: {
    setState: false,
    comment: false,
    edit: false,
    labels: false,
    assignees: false,
  },
  states: [],
  viewer: null,
  body: "",
  comments: [],
  commentsCursor: null,
  events: [],
  linkedPullRequests: [],
};

// Records whether the panel kept the browser from following the link, then stops the browser
// itself so the test page never opens a tab. It runs after React's own listener on the root.
const defaultPrevented: boolean[] = [];
function blockNavigation(event: Event) {
  defaultPrevented.push(event.defaultPrevented);
  event.preventDefault();
}

function setup(): Disposable {
  state.detail = detail;
  state.openLink.mockClear();
  defaultPrevented.length = 0;
  window.addEventListener("click", blockNavigation);
  window.addEventListener("auxclick", blockNavigation);
  return {
    [Symbol.dispose]: () => {
      window.removeEventListener("click", blockNavigation);
      window.removeEventListener("auxclick", blockNavigation);
    },
  };
}

function renderPanel(ref: ScopedThreadRef | null) {
  return render(
    <IssueDetailPanel
      environmentId={environmentId}
      reference={{
        projectId: ProjectId.make("project"),
        tracker: IssueTrackerKind.make("github"),
        scope: "owner/repo",
        key: "7",
      }}
      threadRef={ref}
    />,
  );
}

const issueNumber = (screen: Awaited<ReturnType<typeof renderPanel>>) =>
  screen.getByRole("link", { name: "Open #7 on GitHub" });

function press(element: Element, init: MouseEventInit, type = "click") {
  element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, ...init }));
}

it("opens the issue number through the thread's link setting", async () => {
  using _clicks = setup();
  await using screen = await renderPanel(threadRef);
  const link = issueNumber(screen);
  await expect.element(link).toHaveAttribute("href", url);

  press(link.element(), {});

  expect(state.openLink).toHaveBeenCalledOnce();
  expect(state.openLink).toHaveBeenCalledWith(url, {
    event: expect.objectContaining({ metaKey: false, ctrlKey: false }),
  });
  expect(defaultPrevented).toEqual([true]);
});

it("passes a modified or middle click on so it can still reach the system browser", async () => {
  using _clicks = setup();
  await using screen = await renderPanel(threadRef);
  const link = issueNumber(screen).element();

  press(link, { metaKey: true });
  press(link, { button: 1 }, "auxclick");
  press(link, { button: 2 }, "auxclick");

  expect(state.openLink.mock.calls).toEqual([
    [url, { event: expect.objectContaining({ metaKey: true }) }],
    [url, { event: expect.objectContaining({ button: 1 }) }],
  ]);
  expect(defaultPrevented).toEqual([true, true, false]);
});

it("keeps the plain link outside a thread", async () => {
  using _clicks = setup();
  await using screen = await renderPanel(null);
  const link = issueNumber(screen);
  await expect.element(link).toHaveAttribute("href", url);
  await expect.element(link).toHaveAttribute("target", "_blank");

  press(link.element(), {});

  expect(state.openLink).not.toHaveBeenCalled();
  expect(defaultPrevented).toEqual([false]);
});
