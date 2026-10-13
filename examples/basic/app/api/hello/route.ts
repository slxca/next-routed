import { route } from "next-routed";
import { asAppRoute } from "@/lib/api";

export const GET = asAppRoute(
  route.handle(() => ({ message: "Hello, World!" }))
);
