// pages/api/sites.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE as string // ⚠️ solo en servidor
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { customer_id } = req.query;
    if (!customer_id || typeof customer_id !== "string") {
      return res.status(400).json({ error: "missing customer_id" });
    }

    // Query sites del cliente
    const { data, error } = await supabase
      .from("sites")
      .select("id, notion_database_id, created_at")
      .eq("customer_id", customer_id)
      .order("created_at", { ascending: false });

    if (error) {
      // Loguea el error en Supabase
      await supabase.from("logs").insert({
        customer_id,
        event: "api-sites-error",
        detail: { message: error.message },
      });
      return res.status(500).json({ error: error.message });
    }

    // Log OK
    await supabase.from("logs").insert({
      customer_id,
      event: "api-sites-ok",
      detail: { count: data?.length ?? 0 },
    });

    return res.status(200).json(data ?? []);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "unknown error" });
  }
}
