import { describe, expect, it } from "vitest";
import { canAssumeConversation, canManageAiConversation, createConversationSchema, conversationMessageSchema, conversationStatusLabel } from "./conversation";

describe("conversation validation", () => {
  it("requires a lead and an initial message", () => {
    expect(createConversationSchema.safeParse({ leadId: "bad", body: "" }).success).toBe(false);
  });

  it("accepts simulated whatsapp triage data", () => {
    const result = createConversationSchema.safeParse({ leadId: "8b62eaa0-2b24-4137-9f65-28c97632fe9c", body: "Olá", needsHuman: "on" });
    expect(result.success).toBe(true);
    expect(result.data?.needsHuman).toBe(true);
  });

  it("validates messages", () => {
    expect(conversationMessageSchema.safeParse({ conversationId: "8b62eaa0-2b24-4137-9f65-28c97632fe9c", body: "Mensagem" }).success).toBe(true);
  });

  it("labels statuses", () => {
    expect(conversationStatusLabel("human")).toBe("Humano assumiu");
  });
});

describe("conversation permissions", () => {
  it("permite assumir somente atendimento, gerência e admin; e retomar IA apenas à gestão", () => {
    expect(canAssumeConversation(["atendimento"])).toBe(true);
    expect(canAssumeConversation(["direcao"])).toBe(false);
    expect(canManageAiConversation(["gerencia"])).toBe(true);
    expect(canManageAiConversation(["atendimento"])).toBe(false);
  });
});
