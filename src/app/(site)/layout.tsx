import { ChatWidgetLazy } from "@/components/chat/chat-widget-lazy";
import { CookieBanner } from "@/components/site/cookie-banner";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CookieBanner />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <ChatWidgetLazy />
    </>
  );
}
