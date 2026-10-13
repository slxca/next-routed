import { createRoute } from "next-route-kit";
import { asAppRoute } from "@/lib/api";

export const GET = asAppRoute(
  createRoute({
    handler: () => ({
      message: "Hello, World!",
    }),
  })
);
