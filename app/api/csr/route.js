// This route is the ONLY place the CSR Entra app credentials are used.
// It runs server-side (Next.js API route), never sent to the browser.
//
// ---------------------------------------------------------------------
// STILL NEEDED FROM YOU before this actually works:
//
// 1. A dedicated Entra app registration for CSR (not File Portal's).
//    Needs Application permission: Sites.ReadWrite.All — this route now
//    both reads (GET) and creates (POST) CSR Tracker rows, so read-only
//    is no longer enough.
//    -> gives you: Client ID, Tenant ID, Client Secret
//
// 2. The SharePoint site and list identifiers for the CSR Tracker list.
//
// Field names below are confirmed from the actual list column settings
// screen you shared — no longer guesses.
//
// Once you have the Entra app + site/list IDs, they go in .env.local
// (never committed to git):
//   CSR_TENANT_ID=...
//   CSR_CLIENT_ID=...
//   CSR_CLIENT_SECRET=...
//   CSR_SITE_ID=...
//   CSR_LIST_ID=...
// ---------------------------------------------------------------------

const TENANT_ID = process.env.CSR_TENANT_ID;
const CLIENT_ID = process.env.CSR_CLIENT_ID;
const CLIENT_SECRET = process.env.CSR_CLIENT_SECRET;
const SITE_ID = process.env.CSR_SITE_ID;
const LIST_ID = process.env.CSR_LIST_ID;

// Confirmed real field names from the CSR Tracker list.
const FIELD_MATTER = 'Matter';              // the Case Name equivalent
const FIELD_PRACTICE_GROUP = 'Practicegroup';
const FIELD_FILE_NUMBER = 'Filenumber';
const FIELD_INITIAL_CSR = 'Initialcsr';
const FIELD_PRIOR_CSR = 'Nextcsr2';  // displayed as "PriorcsrDate" but the real internal name is Nextcsr2
const FIELD_NEXT_CSR = 'Nextcsr1';
const FIELD_DATE_OPENED = 'Dateopened';
const FIELD_CREATED_IN_MT = 'CreatedinMT'; // the lock flag - true means "don't edit in the standalone CSR app"

const INITIAL_CSR_OFFSET_DAYS = 45; // Initial CSR Date = Date Opened + 45 days

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function getAccessToken() {
  const url = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get access token: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data.access_token;
}

function checkConfigured() {
  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET || !SITE_ID || !LIST_ID) {
    throw new Error('CSR integration is not configured yet (missing environment variables).');
  }
}

export async function GET(request) {
  try {
    checkConfigured();
    const { searchParams } = new URL(request.url);
    const caseName = searchParams.get('caseName');
    if (!caseName) {
      return Response.json({ error: 'caseName is required' }, { status: 400 });
    }

    const token = await getAccessToken();

    const url =
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LIST_ID}/items` +
      `?expand=fields&$filter=fields/${FIELD_MATTER} eq '${encodeURIComponent(caseName)}'`;

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graph API request failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    const item = data.value?.[0];
    if (!item) return Response.json(null);

    return Response.json({
      initialDate: item.fields[FIELD_INITIAL_CSR] || null,
      mostRecent: item.fields[FIELD_PRIOR_CSR] || null,
      nextDue: item.fields[FIELD_NEXT_CSR] || null,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// Called once, right after a new matter is created in NMT (app/matters/new).
// Creates the matching CSR Tracker row automatically, flagged CreatedinMT
// so the standalone CSR app knows to lock it from manual editing there.
export async function POST(request) {
  try {
    checkConfigured();
    const body = await request.json();
    const { caseName, practiceGroup, fileNumber, dateOpened } = body;

    if (!caseName || !dateOpened) {
      return Response.json({ error: 'caseName and dateOpened are required' }, { status: 400 });
    }

    const token = await getAccessToken();

    const initialCsr = addDays(dateOpened, INITIAL_CSR_OFFSET_DAYS);

    const fields = {
      [FIELD_MATTER]: caseName,
      [FIELD_PRACTICE_GROUP]: practiceGroup || null,
      [FIELD_FILE_NUMBER]: fileNumber || null,
      [FIELD_DATE_OPENED]: dateOpened,
      [FIELD_INITIAL_CSR]: initialCsr,
      [FIELD_CREATED_IN_MT]: true,
    };

    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LIST_ID}/items`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graph API create failed: ${res.status} ${text}`);
    }

    return Response.json({ success: true, initialCsr });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
