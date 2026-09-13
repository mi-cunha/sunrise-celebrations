import { describe, expect, it } from "vitest";
import { whatsappSdkOptions, whatsappSignupOptions } from "./whatsapp-sdk";

describe("WhatsApp business SDK configuration", () => {
  it("explicitly uses business OAuth instead of default personal FedCM login", () => {
    expect(whatsappSdkOptions("12345", "v26.0")).toEqual({
      appId: "12345", version: "v26.0", cookie: true, xfbml: true, fedCM: false,
    });
  });
  it("keeps code exchange and the coexistence configuration together", () => {
    expect(whatsappSignupOptions("54321")).toEqual({
      config_id: "54321", response_type: "code", override_default_response_type: true,
      extras: { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" },
    });
  });
});
