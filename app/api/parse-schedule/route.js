// POST /api/parse-schedule
// Body: either { text: "pasted scheduling order text" }
//    or { fileBase64: "...", mediaType: "application/pdf" | "image/jpeg" | "image/png" }
// Returns: { events: [{ description, category, date }] } or { error }
//
// This never touches Supabase and never writes anything - it only asks
// Claude to read the document and propose candidate events. The caller
// (ImportScheduleModal) is responsible for showing these as an editable,
// confirm-before-write review table. Nothing here is trusted as final.

const VALID_CATEGORIES = [
  'Discovery',
  'Deposition',
  'Mediation',
  'Court Deadline',
  'Hearing',
  'Motion / Brief',
  'Status Conference/Pre-Trial',
  'Trial',
];

const SYSTEM_PROMPT = `You extract scheduling deadlines and events from legal documents (court scheduling orders, Notices of Electronic Filing, deposition notices, or similar) for a law firm's case tracker.

Read the provided document and identify every distinct date-bound event or deadline. For each one, output:
- "description": a short, specific label (e.g. "Discovery Cutoff", "Dispositive Motions Due", "Final Pretrial Conference", "Deposition of Roy Johnson")
- "category": exactly one of: ${VALID_CATEGORIES.map((c) => `"${c}"`).join(', ')}
- "date": the date in YYYY-MM-DD format
- "time": the time in 24-hour HH:MM format if the document explicitly states one (common for Deposition, Hearing, Status Conference/Pre-Trial, Trial, and Mediation), otherwise null
- "witnessName": for a Deposition specifically, the name of the person being deposed if the document states one, otherwise null. Omit or set to null for every other category.

Rules:
- Only include dates that are actually stated in the document. Never guess or infer a date or time that isn't written down.
- If a single line item genuinely has multiple distinct dates (e.g. a motion's filing deadline and a separate response deadline), output separate rows for each rather than combining them.
- A document may contain multiple separate deposition notices, each for a different deponent - output one row per notice, each with its own witnessName, date, and time.
- If you cannot confidently determine which category fits, use "Court Deadline" as the safe default.
- Respond with ONLY a JSON array of objects in the shape described above - no prose, no markdown code fences, no explanation before or after.
- If you find no extractable dates at all, respond with an empty JSON array: []`;

export async function POST(request) {
  try {
    const body = await request.json();
    const { text, fileBase64, mediaType } = body || {};

    if (!text && !fileBase64) {
      return Response.json({ error: 'Provide either pasted text or an uploaded file.' }, { status: 400 });
    }

    const userContent = [];
    if (fileBase64) {
      const isImage = mediaType?.startsWith('image/');
      userContent.push({
        type: isImage ? 'image' : 'document',
        source: { type: 'base64', media_type: mediaType, data: fileBase64 },
      });
    }
    userContent.push({
      type: 'text',
      text: text?.trim()
        ? `Here is the document text:\n\n${text.trim()}`
        : 'Extract the scheduling events from the attached document.',
    });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return Response.json({ error: data.error?.message || 'Claude API request failed.' }, { status: 502 });
    }

    const rawText = (data.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();

    let parsed;
    try {
      // Defensive strip, in case a stray code fence sneaks in despite the prompt.
      const cleaned = rawText.replace(/^```json\s*|^```\s*|```\s*$/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return Response.json({ error: 'Could not parse a response from Claude. Try again, or paste the text instead of uploading.' }, { status: 502 });
    }

    if (!Array.isArray(parsed)) {
      return Response.json({ error: 'Unexpected response shape from Claude.' }, { status: 502 });
    }

    const events = parsed
      .filter((row) => row && row.description && row.date && VALID_CATEGORIES.includes(row.category))
      .map((row) => ({
        description: String(row.description).trim(),
        category: row.category,
        date: row.date,
        time: row.time && /^\d{2}:\d{2}$/.test(row.time) ? row.time : null,
        witnessName: row.category === 'Deposition' && row.witnessName ? String(row.witnessName).trim() : null,
      }));

    return Response.json({ events });
  } catch (err) {
    return Response.json({ error: err.message || 'Unexpected server error.' }, { status: 500 });
  }
}
