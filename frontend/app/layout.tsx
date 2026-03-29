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
        <body style={{ margin: 0, fontFamily: "Arial, Helvetica, sans-serif" }}>
          <Navbar />
          <main style={{ padding: "24px" }}>{children}</main>
        </body>
      </html>
    </UserStateProvider>
  );
}
