import { createTicketSchema, parseTicketFilters, updateTicketSchema } from "@/lib/validation";

describe("parseTicketFilters", () => {
  it("defaults to page 1 with no filters", () => {
    expect(parseTicketFilters({})).toEqual({ page: 1 });
  });

  it("treats empty form fields as no filter", () => {
    expect(parseTicketFilters({ status: "", assignee: "", q: "", page: "" })).toEqual({ page: 1 });
  });

  it("parses every supported filter", () => {
    expect(parseTicketFilters({ status: "open", assignee: "7", q: "  login bug ", page: "3" })).toEqual({
      status: "open",
      assignee: 7,
      q: "login bug",
      page: 3,
    });
  });

  it("keeps the special assignee values", () => {
    expect(parseTicketFilters({ assignee: "me" }).assignee).toBe("me");
    expect(parseTicketFilters({ assignee: "unassigned" }).assignee).toBe("unassigned");
  });

  it("uses the first value when a param is repeated", () => {
    expect(parseTicketFilters({ status: ["resolved", "open"] }).status).toBe("resolved");
  });

  it("falls back to no filters on invalid input instead of throwing", () => {
    expect(parseTicketFilters({ status: "deleted", page: "-2" })).toEqual({ page: 1 });
  });
});

describe("createTicketSchema", () => {
  it("trims text and fills defaults", () => {
    expect(createTicketSchema.parse({ title: "  Printer offline  " })).toEqual({
      title: "Printer offline",
      description: "",
      priority: "medium",
      assigneeId: null,
    });
  });

  it("rejects a title that is too short after trimming", () => {
    expect(createTicketSchema.safeParse({ title: " a " }).success).toBe(false);
  });
});

describe("updateTicketSchema", () => {
  it("rejects an empty patch", () => {
    expect(updateTicketSchema.safeParse({}).success).toBe(false);
  });

  it("allows clearing the assignee", () => {
    expect(updateTicketSchema.parse({ assigneeId: null })).toEqual({ assigneeId: null });
  });
});
