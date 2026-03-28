import { Auth0Provider } from "@auth0/nextjs-auth0";
import Navbar from "./components/Navbar";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Auth0Provider>
      <html lang="en">
        <body style={{ margin: 0, fontFamily: "Arial, Helvetica, sans-serif" }}>
          <Navbar />
          <main style={{ padding: "24px" }}>{children}</main>
        </body>
      </html>
    </Auth0Provider>
  );
}
