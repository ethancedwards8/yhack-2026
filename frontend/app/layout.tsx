import "@/styles/globals.css"
import Navbar from "./components/Navbar";
import VerticalImageRail from "@/app/components/VerticalImageRail";
import { UserStateProvider } from "./context/UserStateContext";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserStateProvider>
      <html lang="en">
        <body className="portalBody">
          <Navbar />
          <main className="portalMain">
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
    </UserStateProvider>
  );
}
