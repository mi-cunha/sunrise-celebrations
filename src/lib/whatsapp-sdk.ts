export function whatsappSdkOptions(appId: string, version: string) {
  // Meta's SDK can default FB.login to FedCM, whose personal-login request
  // drops config_id/code/extras. Embedded Signup needs the business OAuth flow.
  // This is the SDK's explicit initialization option, not a browser setting.
  return { appId, version, cookie: true, xfbml: true, fedCM: false };
}

export function whatsappSignupOptions(configId: string) {
  return {
    config_id: configId,
    response_type: "code",
    override_default_response_type: true,
    extras: { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" },
  };
}
