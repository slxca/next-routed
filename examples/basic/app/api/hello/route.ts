import { route } from "next-route-kit";
import { asAppRoute } from "@/lib/api";

export const GET = asAppRoute(
  route.handle(() => ({ message: "Hello, World!" }))
);
