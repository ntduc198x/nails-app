import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type JobRow = {
  id: string;
  table_name: string;
  record_id: string;
  target_locale: "en";
  force_overwrite: boolean;
  requested_fields: string[] | null;
};

type TableConfig = {
  select: string;
  sourceFields: string[];
  deterministicFields: string[];
  sourcePayload: (row: Record<string, unknown>) => Record<string, unknown>;
};

const OPENAI_URL = "https://api.openai.com/v1/responses";
const OPENAI_MODEL = Deno.env.get("OPENAI_TRANSLATION_MODEL") || "gpt-4o-mini";

const DETERMINISTIC_DICTIONARIES: Record<string, Record<string, string>> = {
  lookbook_badge: {
    hot: "Hot",
    trend: "Trend",
    "noi bat": "Featured",
    lookbook: "Lookbook",
  },
  lookbook_tone: {
    "nhe nhang": "Soft",
    "don gian": "Minimal",
    "sang trong": "Luxury",
    "ca tinh": "Edgy",
    "noi bat": "Standout",
    "cham soc": "Care",
  },
  product_type: {
    accessory: "Accessory",
    care: "Care",
    gel: "Gel",
    polish: "Polish",
    tool: "Tool",
  },
};

const TABLE_CONFIGS: Record<string, TableConfig> = {
  branches: {
    select: "id,org_id,branch_id,name,translations,translation_meta",
    sourceFields: ["name"],
    deterministicFields: [],
    sourcePayload: (row) => ({ name: row.name ?? null }),
  },
  resources: {
    select: "id,org_id,branch_id,name,translations,translation_meta",
    sourceFields: ["name"],
    deterministicFields: [],
    sourcePayload: (row) => ({ name: row.name ?? null }),
  },
  services: {
    select:
      "id,org_id,branch_id,name,short_description,lookbook_badge,lookbook_tone,duration_label,duration_min,translations,translation_meta",
    sourceFields: ["name", "short_description", "lookbook_badge", "lookbook_tone", "duration_label"],
    deterministicFields: ["lookbook_badge", "lookbook_tone", "duration_label"],
    sourcePayload: (row) => ({
      name: row.name ?? null,
      short_description: row.short_description ?? null,
      lookbook_badge: row.lookbook_badge ?? null,
      lookbook_tone: row.lookbook_tone ?? null,
      duration_label: row.duration_label ?? (typeof row.duration_min === "number" ? `${row.duration_min} phút` : null),
    }),
  },
  storefront_profile: {
    select:
      "id,org_id,branch_id,name,category,description,reviews_label,address_line,opening_hours,highlights,translations,translation_meta",
    sourceFields: ["name", "category", "description", "reviews_label", "address_line", "opening_hours", "highlights"],
    deterministicFields: [],
    sourcePayload: (row) => ({
      name: row.name ?? null,
      category: row.category ?? null,
      description: row.description ?? null,
      reviews_label: row.reviews_label ?? null,
      address_line: row.address_line ?? null,
      opening_hours: row.opening_hours ?? null,
      highlights: Array.isArray(row.highlights) ? row.highlights : [],
    }),
  },
  storefront_team_members: {
    select: "id,org_id,display_name,role_label,bio,translations,translation_meta",
    sourceFields: ["display_name", "role_label", "bio"],
    deterministicFields: [],
    sourcePayload: (row) => ({
      display_name: row.display_name ?? null,
      role_label: row.role_label ?? null,
      bio: row.bio ?? null,
    }),
  },
  storefront_products: {
    select: "id,org_id,name,subtitle,price_label,product_type,translations,translation_meta",
    sourceFields: ["name", "subtitle", "price_label", "product_type"],
    deterministicFields: ["price_label", "product_type"],
    sourcePayload: (row) => ({
      name: row.name ?? null,
      subtitle: row.subtitle ?? null,
      price_label: row.price_label ?? null,
      product_type: row.product_type ?? null,
    }),
  },
  storefront_gallery: {
    select: "id,org_id,title,translations,translation_meta",
    sourceFields: ["title"],
    deterministicFields: [],
    sourcePayload: (row) => ({
      title: row.title ?? null,
    }),
  },
  marketing_offers: {
    select: "id,org_id,title,description,badge,translations,translation_meta",
    sourceFields: ["title", "description", "badge"],
    deterministicFields: [],
    sourcePayload: (row) => ({
      title: row.title ?? null,
      description: row.description ?? null,
      badge: row.badge ?? null,
    }),
  },
  customer_content_posts: {
    select: "id,org_id,title,summary,body,source_platform,translations,translation_meta",
    sourceFields: ["title", "summary", "body", "source_platform"],
    deterministicFields: [],
    sourcePayload: (row) => ({
      title: row.title ?? null,
      summary: row.summary ?? null,
      body: row.body ?? null,
      source_platform: row.source_platform ?? null,
    }),
  },
};

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function getManualMode(translationMeta: Record<string, unknown>, field: string) {
  return translationMeta?.fields &&
    typeof translationMeta.fields === "object" &&
    translationMeta.fields &&
    typeof (translationMeta.fields as Record<string, unknown>)[field] === "object" &&
    (asRecord((translationMeta.fields as Record<string, unknown>)[field]).mode === "manual")
    ? "manual"
    : "auto";
}

function deterministicTranslate(field: string, value: unknown) {
  if (value == null) return null;

  if (field === "duration_label" && typeof value === "string") {
    const numeric = value.match(/\d+/)?.[0];
    return numeric ? `${numeric} min` : null;
  }

  if (field === "price_label" && typeof value === "string") {
    const text = value.trim();
    if (!text) return null;
    if (/contact/i.test(text)) return "Contact for price";
    return text.replace(/\./g, ",").replace(/đ/gi, " VND").replace(/\bd\b/gi, "VND").trim();
  }

  if (typeof value === "string") {
    return DETERMINISTIC_DICTIONARIES[field]?.[normalizeKey(value)] ?? null;
  }

  return null;
}

async function sha256(input: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(input ?? null));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

function buildSchema(fields: Record<string, unknown>) {
  const properties: Record<string, unknown> = {};
  const required = Object.keys(fields);

  for (const [field, value] of Object.entries(fields)) {
    properties[field] = Array.isArray(value)
      ? {
          type: "array",
          items: { type: "string" },
        }
      : {
          type: "string",
        };
  }

  return {
    type: "object",
    additionalProperties: false,
    properties,
    required,
  };
}

function extractOutputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const output = Array.isArray(payload.output) ? payload.output : [];
  const parts: string[] = [];

  for (const item of output) {
    const record = asRecord(item);
    const content = Array.isArray(record.content) ? record.content : [];
    for (const contentItem of content) {
      const contentRecord = asRecord(contentItem);
      if (typeof contentRecord.text === "string" && contentRecord.text.trim()) {
        parts.push(contentRecord.text.trim());
      }
    }
  }

  return parts.join("\n").trim();
}

async function translateWithOpenAI(apiKey: string, tableName: string, fields: Record<string, unknown>) {
  const schema = buildSchema(fields);
  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      instructions:
        `Translate the provided Vietnamese salon content into natural, polished English for a premium beauty booking app.` +
        ` Write like a skilled human localizer, not a literal machine translation.` +
        ` Keep brand names, proper nouns, and product names unchanged unless a natural English form is obvious.` +
        ` Preserve the original meaning, emotional tone, and intended length for each field.` +
        ` For short UI labels, badges, titles, and highlights, keep wording concise, fluent, and customer-facing.` +
        ` For descriptions and body text, make the English read smoothly and professionally for salon customers.` +
        ` Do not add placeholder copy, explanations, or extra facts.` +
        ` Return only the translated JSON fields for table ${tableName}.`,
      input: JSON.stringify(fields),
      text: {
        format: {
          type: "json_schema",
          name: "translation_result",
          schema,
          strict: true,
        },
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenAI translation failed: ${response.status} ${message}`);
  }

  const payload = await response.json();
  const outputText = extractOutputText(asRecord(payload));
  if (!outputText.trim()) {
    throw new Error("OpenAI translation returned empty output_text");
  }

  return JSON.parse(outputText) as Record<string, unknown>;
}

async function processJob(supabase: ReturnType<typeof createClient>, openAiKey: string, job: JobRow) {
  const tableConfig = TABLE_CONFIGS[job.table_name];
  if (!tableConfig) {
    throw new Error(`Unsupported table config: ${job.table_name}`);
  }

  const { data: row, error: rowError } = await supabase
    .from(job.table_name)
    .select(tableConfig.select)
    .eq("id", job.record_id)
    .single();

  if (rowError) throw rowError;

  const sourcePayload = tableConfig.sourcePayload(asRecord(row));
  const existingTranslations = asRecord(row.translations);
  const existingEnglish = asRecord(existingTranslations.en);
  const translationMeta = asRecord(row.translation_meta);
  const fieldNames = (job.force_overwrite || !Array.isArray(job.requested_fields) || !job.requested_fields.length)
    ? tableConfig.sourceFields
    : job.requested_fields;

  const deterministic: Record<string, unknown> = {};
  const freeform: Record<string, unknown> = {};

  for (const field of fieldNames) {
    if (!job.force_overwrite && getManualMode(translationMeta, field) === "manual") {
      continue;
    }

    const value = sourcePayload[field];
    if (tableConfig.deterministicFields.includes(field)) {
      deterministic[field] = deterministicTranslate(field, value);
    } else {
      freeform[field] = Array.isArray(value) ? value : (value == null ? "" : String(value));
    }
  }

  const aiTranslations =
    Object.keys(freeform).length > 0
      ? await translateWithOpenAI(openAiKey, job.table_name, freeform)
      : {};

  const translatedEnglish = {
    ...existingEnglish,
    ...deterministic,
    ...aiTranslations,
  };

  const nextFieldsMeta = { ...asRecord(translationMeta.fields) };
  const now = new Date().toISOString();

  for (const field of fieldNames) {
    if (!job.force_overwrite && getManualMode(translationMeta, field) === "manual") {
      continue;
    }
    const previous = asRecord(nextFieldsMeta[field]);
    nextFieldsMeta[field] = {
      ...previous,
      mode: previous.mode === "manual" && !job.force_overwrite ? "manual" : "auto",
      status: "translated",
      sourceHash: await sha256(sourcePayload[field]),
      updatedAt: now,
      error: null,
    };
  }

  const nextTranslationMeta = {
    ...translationMeta,
    sourceLocale: "vi",
    fields: nextFieldsMeta,
    targets: {
      ...asRecord(translationMeta.targets),
      en: {
        ...asRecord(asRecord(translationMeta.targets).en),
        status: "translated",
        lastJobId: job.id,
        lastTranslatedAt: now,
        updatedAt: now,
        error: null,
      },
    },
  };

  const nextTranslations = {
    ...existingTranslations,
    en: translatedEnglish,
  };

  const { error: updateError } = await supabase
    .from(job.table_name)
    .update({
      translations: nextTranslations,
      translation_meta: nextTranslationMeta,
    })
    .eq("id", job.record_id);

  if (updateError) throw updateError;

  const { error: finishError } = await supabase
    .from("content_translation_jobs")
    .update({
      status: "completed",
      finished_at: now,
      error_message: null,
    })
    .eq("id", job.id);

  if (finishError) throw finishError;
}

Deno.serve(async (request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const openAiKey = Deno.env.get("OPENAI_API_KEY")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
  const limit = Math.max(1, Math.min(Number(body?.limit ?? 5) || 5, 25));

  const { data: jobs, error: jobsError } = await supabase
    .from("content_translation_jobs")
    .select("id,table_name,record_id,target_locale,force_overwrite,requested_fields")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (jobsError) {
    return Response.json({ ok: false, stage: "load_jobs", error: jobsError.message }, { status: 500 });
  }

  const processed: Array<{ id: string; status: string; error?: string }> = [];

  for (const job of (jobs ?? []) as JobRow[]) {
    const { error: startError } = await supabase
      .from("content_translation_jobs")
      .update({
        status: "in_progress",
        attempt_count: 1,
        started_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", job.id)
      .eq("status", "pending");

    if (startError) {
      processed.push({ id: job.id, status: "skipped", error: startError.message });
      continue;
    }

    try {
      await processJob(supabase, openAiKey, job);
      processed.push({ id: job.id, status: "completed" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      await supabase
        .from("content_translation_jobs")
        .update({
          status: "error",
          finished_at: new Date().toISOString(),
          error_message: message,
        })
        .eq("id", job.id);

      processed.push({ id: job.id, status: "error", error: message });
    }
  }

  return Response.json({
    ok: true,
    processed,
  });
});
