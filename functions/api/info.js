const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
}

export async function onRequestGet({ env }) {
  if (!env.CARDS_KV) {
    return jsonResponse({ error: "CARDS_KV binding is not configured" }, 503);
  }

  try {
    const raw = await env.CARDS_KV.get("info.json");
    if (!raw) {
      return jsonResponse(
        { error: "info.json is missing from Workers KV" },
        404,
      );
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      console.error("info.json is not valid JSON", error);
      return jsonResponse({ error: "info.json is invalid" }, 500);
    }

    if (!data || typeof data !== "object" || !data.issuers) {
      return jsonResponse(
        { error: "info.json is missing from Workers KV" },
        404,
      );
    }
    return jsonResponse(data);
  } catch (error) {
    console.error("Failed to read info.json from Workers KV", error);
    return jsonResponse({ error: "Unable to read card info" }, 500);
  }
}
