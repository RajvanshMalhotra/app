export { auth as proxy } from "@/auth";

export const config = { matcher: ["/", "/today/:path*", "/stats/:path*", "/leaderboard/:path*", "/library/:path*"] };
