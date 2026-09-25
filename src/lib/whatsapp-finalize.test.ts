import { describe, expect, it, vi } from "vitest";
import { finalizeWhatsApp } from "./whatsapp-finalize";

describe("coexistence finalization", () => {
  it("finalizes with a code even when the session event is missing", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ connected: true }));
    expect(await finalizeWhatsApp({ code: "fixture-code" }, false, request)).toEqual({ connected: true, syncAccepted: false });
    expect(request).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toEqual({ code: "fixture-code" });
  });
  it("requests authorized history immediately after connection, without passing the code", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ connected: true })).mockResolvedValueOnce(Response.json({ accepted: true }));
    expect((await finalizeWhatsApp({ code: "fixture-code" }, true, request)).syncAccepted).toBe(true);
    expect(request.mock.calls.map(([url]) => url)).toEqual(["/api/whatsapp/connect", "/api/whatsapp/sync"]);
    expect(JSON.parse(String(request.mock.calls[1][1]?.body))).toEqual({ confirm: true });
  });
  it("never imports if finalization fails", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ error: "not connected" }, { status: 409 }));
    await expect(finalizeWhatsApp({ code: "fixture-code" }, true, request)).rejects.toThrow("not connected");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("preserves connection success when history fails, without retrying", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ connected: true })).mockRejectedValueOnce(new Error("uncertain"));
    expect(await finalizeWhatsApp({ code: "fixture-code" }, true, request)).toEqual({ connected: true, syncAccepted: false, syncError: "uncertain" });
    expect(request).toHaveBeenCalledTimes(2);
  });
});
