"use client";
import { createAuthClient } from "better-auth/react";

/** Browser auth client. Talks only to our own /api/auth routes. */
export const authClient = createAuthClient();
