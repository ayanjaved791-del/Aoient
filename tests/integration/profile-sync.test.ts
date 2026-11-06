/** The migration's trigger mirrors Supabase auth.users into public.profile. */
import { beforeEach, describe, expect, it } from "vitest";
import { createUser, db, resetDatabase } from "../support/db";

describe("profile sync from Supabase Auth users", () => {
  beforeEach(resetDatabase);

  it("creates a profile with the sign-up name, lower-cased email and verification state", async () => {
    const sql = db();
    const [u] = await sql<{ id: string }[]>`
      insert into auth.users (email, raw_user_meta_data) values ('Mixed.Case@Example.test', ${sql.json({ name: "Amira Khan" })}) returning id`;
    const [p] = await sql`select name, email, email_verified, status from profile where id = ${u.id}`;
    expect(p).toMatchObject({ name: "Amira Khan", email: "mixed.case@example.test", email_verified: false, status: "active" });
  });

  it("marks the email verified when Supabase confirms it, and follows email changes", async () => {
    const sql = db();
    const user = await createUser({ verified: false, name: "Leo Park" });
    await sql`update auth.users set email_confirmed_at = now() where id = ${user.id}`;
    expect((await sql`select email_verified from profile where id = ${user.id}`)[0].email_verified).toBe(true);
    await sql`update auth.users set email = 'leo.new@example.test' where id = ${user.id}`;
    const [p] = await sql`select email, name from profile where id = ${user.id}`;
    expect(p).toMatchObject({ email: "leo.new@example.test", name: "Leo Park" });
  });

  it("falls back to the email's local part when no name is given", async () => {
    const sql = db();
    const [u] = await sql<{ id: string }[]>`insert into auth.users (email) values ('noname@example.test') returning id`;
    expect((await sql`select name from profile where id = ${u.id}`)[0].name).toBe("noname");
  });

  it("deleting the auth user removes the profile", async () => {
    const sql = db();
    const user = await createUser();
    await sql`delete from auth.users where id = ${user.id}`;
    expect((await sql`select 1 from profile where id = ${user.id}`).length).toBe(0);
  });
});
