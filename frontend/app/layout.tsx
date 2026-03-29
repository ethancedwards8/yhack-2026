import "@/styles/globals.css"
import Navbar from "./components/Navbar";
import VerticalImageRail from "@/app/components/VerticalImageRail";
import FaxSidebar from "@/app/components/FaxSidebar";
import { UserStateProvider } from "./context/UserStateContext";
import { CurrentBillProvider } from "./context/CurrentBillContext";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserStateProvider>
      <CurrentBillProvider>
        <html lang="en">
          <body className="portalBody">
            <Navbar />
            <main className="portalMain">
              <FaxSidebar />
              <VerticalImageRail
                images={[
                  {
                    src: "/images/terry.png",
                    alt: "Terry banner",
                    width: 900,
                    height: 1600,
                  },
                  {
                    src: "/images/TRIOLLIONDOLLAR.PNG",
                    alt: "Trillion dollar banner",
                    width: 900,
                    height: 1600,
                  },
                ]}
              />
              <div className="portalContentFrame">{children}</div>
            </main>
          </body>
        </html>
      </CurrentBillProvider>
    </UserStateProvider>
  );
}
