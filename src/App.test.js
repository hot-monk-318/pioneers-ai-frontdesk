import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

jest.mock("react-markdown", () => ({ children }) => <>{children}</>);
jest.mock("remark-gfm", () => () => null);

// ─── helpers ────────────────────────────────────────────────────────────────

function mockFetch(reply, ok = true) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(ok ? { reply } : { error: reply })
  });
}

// ─── flattenPolicies / unflattenPolicies (tested via App initialisation) ────

describe("policy flatten/unflatten round-trip", () => {
  it("policy editor shows flattened tuition keys", () => {
    render(<App />);
    fireEvent.click(screen.getByText(/operator view/i));
    expect(screen.getByText("tuition.infant")).toBeInTheDocument();
    expect(screen.getByText("tuition.toddler")).toBeInTheDocument();
    expect(screen.getByText("tuition.preschool")).toBeInTheDocument();
  });

  it("knowledge base section heading is rendered on operator view", () => {
    render(<App />);
    fireEvent.click(screen.getByText(/operator view/i));
    expect(screen.getByRole("heading", { name: /3\) knowledge base/i })).toBeInTheDocument();
  });
});

// ─── App shell ──────────────────────────────────────────────────────────────

describe("App shell", () => {
  it("renders brand title in header", () => {
    render(<App />);
    expect(screen.getByText("Pioneers Learning Center", { selector: ".brand-title" })).toBeInTheDocument();
  });

  it("renders Parent Chat heading by default", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /parent chat/i })).toBeInTheDocument();
  });

  it("switches to Operator Dashboard on tab click", () => {
    render(<App />);
    fireEvent.click(screen.getByText(/operator view/i));
    expect(screen.getByRole("heading", { name: /operator dashboard/i })).toBeInTheDocument();
  });

  it("switches back to Parent Chat from Operator", () => {
    render(<App />);
    fireEvent.click(screen.getByText(/operator view/i));
    fireEvent.click(screen.getByText(/parent view/i));
    expect(screen.getByRole("heading", { name: /parent chat/i })).toBeInTheDocument();
  });

  it("shows no badge when there are no flagged questions", () => {
    render(<App />);
    expect(document.querySelector(".badge")).not.toBeInTheDocument();
  });
});

// ─── ParentView ──────────────────────────────────────────────────────────────

describe("ParentView", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows the initial greeting message", () => {
    render(<App />);
    expect(screen.getByText(/virtual front desk assistant/i)).toBeInTheDocument();
  });

  it("shows Send button and input field", () => {
    render(<App />);
    expect(screen.getByPlaceholderText(/type your question/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
  });

  it("disables send button while a message is loading", async () => {
    mockFetch("Some reply");
    render(<App />);
    const input = screen.getByPlaceholderText(/type your question/i);
    await userEvent.type(input, "hello");
    fireEvent.submit(input.closest("form"));
    expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole("button", { name: /send/i })).not.toBeDisabled());
  });

  it("displays a successful AI reply in the chat window", async () => {
    mockFetch("We are open Monday through Friday.");
    render(<App />);
    const input = screen.getByPlaceholderText(/type your question/i);
    await userEvent.type(input, "What are your hours?");
    fireEvent.submit(input.closest("form"));
    await waitFor(() => expect(screen.getByText(/monday through friday/i)).toBeInTheDocument());
  });

  it("clears the input after sending", async () => {
    mockFetch("ok");
    render(<App />);
    const input = screen.getByPlaceholderText(/type your question/i);
    await userEvent.type(input, "hello");
    fireEvent.submit(input.closest("form"));
    await waitFor(() => expect(input.value).toBe(""));
  });

  it("does not submit an empty message", async () => {
    mockFetch("nope");
    render(<App />);
    const btn = screen.getByRole("button", { name: /send/i });
    fireEvent.click(btn);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("shows error text when fetch fails and displays fallback", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));
    render(<App />);
    const input = screen.getByPlaceholderText(/type your question/i);
    await userEvent.type(input, "What are your hours?");
    fireEvent.submit(input.closest("form"));
    await waitFor(() => expect(screen.getByText(/claude endpoint unavailable/i)).toBeInTheDocument());
    expect(screen.getByText(/our hours are/i)).toBeInTheDocument();
  });

  it("flags a question when AI says it will connect to staff", async () => {
    mockFetch("I'll connect you with our staff and flag it.");
    render(<App />);
    const input = screen.getByPlaceholderText(/type your question/i);
    await userEvent.type(input, "Unusual question");
    fireEvent.submit(input.closest("form"));
    await waitFor(() => expect(screen.getByText("1")).toBeInTheDocument());
    fireEvent.click(screen.getByText(/operator view/i));
    expect(screen.getByText(/unusual question/i)).toBeInTheDocument();
  });

  it("badge count increments when a question is flagged", async () => {
    mockFetch("I'll connect you with our staff and flag it.");
    render(<App />);
    const input = screen.getByPlaceholderText(/type your question/i);
    await userEvent.type(input, "mystery question");
    fireEvent.submit(input.closest("form"));
    await waitFor(() => expect(screen.getByText("1")).toBeInTheDocument());
  });
});

// ─── getFallbackReply (exercised via fetch failure) ──────────────────────────

describe("getFallbackReply fallback keywords", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockRejectedValue(new Error("offline"));
  });

  async function sendMessage(text) {
    render(<App />);
    const input = screen.getByPlaceholderText(/type your question/i);
    await userEvent.type(input, text);
    fireEvent.submit(input.closest("form"));
    await waitFor(() => expect(screen.queryByText(/thinking/i)).not.toBeInTheDocument());
  }

  it("returns hours for 'hour' keyword", async () => {
    await sendMessage("what are your hours");
    expect(screen.getByText(/monday-friday/i)).toBeInTheDocument();
  });

  it("returns sick child policy for 'fever' keyword", async () => {
    await sendMessage("my child has a fever");
    expect(screen.getByText(/100\.4/)).toBeInTheDocument();
  });

  it("returns tuition info for 'cost' keyword", async () => {
    await sendMessage("what is the cost");
    expect(screen.getByText(/tuition is/i)).toBeInTheDocument();
  });

  it("returns default escalation message for unknown input", async () => {
    await sendMessage("xyzzy unknown");
    expect(screen.getAllByText(/i'll connect you with our staff/i).length).toBeGreaterThan(0);
  });
});

// ─── shouldEscalateReply (tested via App integration) ───────────────────────

describe("shouldEscalateReply escalation patterns", () => {
  // "flagged" does NOT match \bflag\b (word boundary fails after "flag" in "flagged")
  const escalatingReplies = [
    "I'll connect you with our staff and flag it.",
    "I don\u2019t know the answer to that.",
    "Let me escalate this to the team.",
    "I am not sure about that.",
    "I cannot answer that question."
  ];

  escalatingReplies.forEach((reply) => {
    it(`flags question for reply: "${reply.slice(0, 50)}"`, async () => {
      mockFetch(reply);
      render(<App />);
      const input = screen.getByPlaceholderText(/type your question/i);
      await userEvent.type(input, "some question");
      fireEvent.submit(input.closest("form"));
      await waitFor(() => expect(screen.queryByText(/thinking/i)).not.toBeInTheDocument());
      expect(screen.getByText("1")).toBeInTheDocument();
    });
  });

  it("does NOT flag a normal non-escalating reply", async () => {
    mockFetch("We are open Monday through Friday 7am to 6pm.");
    render(<App />);
    const input = screen.getByPlaceholderText(/type your question/i);
    await userEvent.type(input, "hours?");
    fireEvent.submit(input.closest("form"));
    await waitFor(() => expect(screen.queryByText(/thinking/i)).not.toBeInTheDocument());
    expect(document.querySelector(".badge")).not.toBeInTheDocument();
  });
});

// ─── CustomSelect ────────────────────────────────────────────────────────────

describe("CustomSelect", () => {
  async function openOperatorWithFlag() {
    mockFetch("I'll connect you with our staff and flag it.");
    render(<App />);
    const input = screen.getByPlaceholderText(/type your question/i);
    await userEvent.type(input, "test question");
    fireEvent.submit(input.closest("form"));
    await waitFor(() => expect(screen.getByText("1")).toBeInTheDocument());
    fireEvent.click(screen.getByText(/operator view/i));
  }

  it("shows the default selected option label", async () => {
    await openOperatorWithFlag();
    expect(screen.getByText("Connect staff", { selector: ".custom-select-label" })).toBeInTheDocument();
  });

  it("opens the listbox when the button is clicked", async () => {
    await openOperatorWithFlag();
    userEvent.click(screen.getByText("Connect staff", { selector: ".custom-select-label" }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("updates selected label after choosing an option", async () => {
    await openOperatorWithFlag();
    userEvent.click(screen.getByText("Connect staff", { selector: ".custom-select-label" }));
    userEvent.click(screen.getByRole("option", { name: /policy clarification/i }));
    await waitFor(() =>
      expect(
        screen.getByText("Policy clarification needed", { selector: ".custom-select-label" })
      ).toBeInTheDocument()
    );
  });

  it("closes when clicking outside", async () => {
    await openOperatorWithFlag();
    userEvent.click(screen.getByText("Connect staff", { selector: ".custom-select-label" }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    userEvent.click(document.body);
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
  });

  it("shows Other textarea only when OTHER is selected", async () => {
    await openOperatorWithFlag();
    expect(screen.queryByPlaceholderText(/operator resolution notes/i)).not.toBeInTheDocument();
    userEvent.click(screen.getByText("Connect staff", { selector: ".custom-select-label" }));
    userEvent.click(screen.getByRole("option", { name: /other/i }));
    await waitFor(() =>
      expect(screen.getByPlaceholderText(/operator resolution notes/i)).toBeInTheDocument()
    );
  });
});

// ─── OperatorView ─────────────────────────────────────────────────────────────

describe("OperatorView", () => {
  async function setupWithFlag() {
    mockFetch("I'll connect you with our staff and flag it.");
    render(<App />);
    const input = screen.getByPlaceholderText(/type your question/i);
    await userEvent.type(input, "Where are you located?");
    fireEvent.submit(input.closest("form"));
    await waitFor(() => expect(screen.getByText("1")).toBeInTheDocument());
    fireEvent.click(screen.getByText(/operator view/i));
  }

  it("shows 'No flagged questions yet' when list is empty", () => {
    render(<App />);
    fireEvent.click(screen.getByText(/operator view/i));
    expect(screen.getByText(/no flagged questions yet/i)).toBeInTheDocument();
  });

  it("displays the flagged question text", async () => {
    await setupWithFlag();
    expect(screen.getByText("Where are you located?")).toBeInTheDocument();
  });

  it("Resolve button is enabled for non-OTHER resolution types", async () => {
    await setupWithFlag();
    expect(screen.getByRole("button", { name: /resolve/i })).not.toBeDisabled();
  });

  it("Resolve button is disabled for OTHER until text is entered", async () => {
    await setupWithFlag();
    userEvent.click(screen.getByText("Connect staff", { selector: ".custom-select-label" }));
    userEvent.click(screen.getByRole("option", { name: /other/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /resolve/i })).toBeDisabled());
  });

  it("Resolve button re-enables after typing OTHER text", async () => {
    await setupWithFlag();
    userEvent.click(screen.getByText("Connect staff", { selector: ".custom-select-label" }));
    userEvent.click(screen.getByRole("option", { name: /other/i }));
    const textarea = await screen.findByPlaceholderText(/operator resolution notes/i);
    userEvent.type(textarea, "Custom resolution");
    await waitFor(() => expect(screen.getByRole("button", { name: /resolve/i })).not.toBeDisabled());
  });

  it("resolving removes item from unresolved list", async () => {
    await setupWithFlag();
    fireEvent.click(screen.getByRole("button", { name: /resolve/i }));
    expect(document.querySelectorAll(".unresolved-item").length).toBe(0);
    expect(screen.getByText(/no flagged questions yet/i)).toBeInTheDocument();
  });

  it("resolved item appears in resolved section", async () => {
    await setupWithFlag();
    fireEvent.click(screen.getByRole("button", { name: /resolve/i }));
    expect(screen.getByText(/resolved questions/i)).toBeInTheDocument();
    expect(document.querySelectorAll(".resolved-item").length).toBe(1);
  });

  it("badge disappears after resolving all flagged questions", async () => {
    await setupWithFlag();
    fireEvent.click(screen.getByRole("button", { name: /resolve/i }));
    fireEvent.click(screen.getByText(/parent view/i));
    expect(document.querySelector(".badge")).not.toBeInTheDocument();
  });

  it("policy editor allows editing a field", async () => {
    render(<App />);
    fireEvent.click(screen.getByText(/operator view/i));
    const lunchTextarea = screen.getByDisplayValue(/\$8\/day/);
    fireEvent.change(lunchTextarea, { target: { value: "New lunch policy" } });
    expect(screen.getByDisplayValue("New lunch policy")).toBeInTheDocument();
  });

  it("knowledge base section is present in operator view", () => {
    render(<App />);
    fireEvent.click(screen.getByText(/operator view/i));
    expect(screen.getByRole("heading", { name: /3\) knowledge base/i })).toBeInTheDocument();
  });
});
