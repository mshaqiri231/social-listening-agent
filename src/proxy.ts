// Password-protects the whole app when APP_PASSWORD is set (always set it on a public URL:
// otherwise anyone could read the collected posts and spend the Anthropic API budget).
// Uses the browser's built-in login prompt (HTTP Basic Auth); any username works.
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next(); // local development: no login

  // Header looks like "Basic base64(username:password)"
  const header = request.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = atob(encoded);
    const given = decoded.slice(decoded.indexOf(":") + 1);
    if (given === password) return NextResponse.next();
  }

  return new NextResponse("Login required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Social Listening", charset="UTF-8"' },
  });
}

export const config = {
  // Everything except Next.js build files and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
