import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sunrise OS",
  description: "Gestão de celebrações",
};

const extensionErrorGuard =
  process.env.NODE_ENV === "development" ? (
    <Script
      id="extension-error-guard"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          window.addEventListener("error", function (event) {
            var isExtensionError = typeof event.filename === "string" && event.filename.indexOf("chrome-extension://") === 0;
            var isKnownInjectedError = typeof event.message === "string" && event.message.indexOf("M_ID") !== -1;
            if (isExtensionError && isKnownInjectedError) {
              event.preventDefault();
              event.stopImmediatePropagation();
            }
          }, true);

          window.addEventListener("unhandledrejection", function (event) {
            var reason = event.reason;
            var message = reason && (reason.message || String(reason));
            var stack = reason && reason.stack;
            var isKnownInjectedError = typeof message === "string" && message.indexOf("M_ID") !== -1;
            var isExtensionStack = typeof stack === "string" && stack.indexOf("chrome-extension://") !== -1;
            if (isKnownInjectedError && isExtensionStack) {
              event.preventDefault();
              event.stopImmediatePropagation();
            }
          }, true);
        `,
      }}
    />
  ) : null;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        {extensionErrorGuard}
        {children}
      </body>
    </html>
  );
}
