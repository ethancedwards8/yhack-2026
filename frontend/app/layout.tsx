import "@/styles/globals.css"
import Navbar from "./components/Navbar";
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
            <div className="portalContentFrame">{children}</div>
          </main>
        </body>
      </html>
    </UserStateProvider>
  );
}
