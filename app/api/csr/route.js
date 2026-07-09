// This route is the ONLY place the CSR Entra app credentials are used.
// It runs server-side (Next.js API route), never sent to the browser.
//
// ---------------------------------------------------------------------
// STILL NEEDED FROM YOU before this actually works — everything marked
// TODO below is a real gap, not a style choice:
//
// 1. A dedicated Entra app registration for CSR (do NOT reuse File
//    Portal's — different purpose, should have its own scoped secret).
//    Needs Application permission: Sites.Read.All (read-only is enough
//    here, since this route never writes).
//    -> gives you: Client ID, Tenant ID, Client Secret
//
// 2. The exact SharePoint site and list identifiers for the "HCC CSR
//    Tracker" list — either the site/list names (used with Graph's
//    site-path lookup) or their raw IDs if you already have them from
//    another integration.
//
// 3. The exact internal column names on that list for: Case Name,
//    Initial CSR Date, Most Recent CSR, Next CSR Due. SharePoint's
//    *displayed* column names often differ from their internal field
//    names (this bit us before with AssignedStaff vs Assignedstaff) —
//    these need to be pulled from the list itself, not guessed.
//
// Once you have these, they go in .env.local (never committed to git):
//   CSR_TENANT_ID=...
//   CSR_CLIENT_ID=...
//   CSR_CLIENT_SECRET=...
//   CSR_SITE_ID=...      (or CSR_SITE_PATH, see getSiteId below)
//   CSR_LIST_ID=...      (or CSR_LIST_NAME)
// ---------------------------------------------------------------------

const TENANT_ID = process.env.CSR_TENANT_ID;
const CLIENT_ID = process.env.CSR_CLIENT_ID;
const CLIENT_SECRET = process.env.CSR_CLIENT_SECRET;
const SITE_ID = process.env.CSR_SITE_ID; // TODO: confirm - see note above
const LIST_ID = process.env.CSR_LIST_ID; // TODO: confirm - see note above

// TODO: confirm these match the list's actual internal field names
const FIELD_CASE_NAME = 'CaseName';
const FIELD_INITIAL_DATE = 'InitialCSRDate';
const FIELD_MOST_RECENT = 'MostRecentCSR';
const FIELD_NEXT_DUE = 'NextCSRDue';

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

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const caseName = searchParams.get('caseName');
    if (!caseName) {
      return Response.json({ error: 'caseName is required' }, { status: 400 });
    }

    if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET || !SITE_ID || !LIST_ID) {
      return Response.json(
        { error: 'CSR integration is not configured yet (missing environment variables).' },
        { status: 500 }
      );
    }

    const token = await getAccessToken();

    // Graph API: list items, expanded to include field values, filtered by
    // Case Name. $filter on lookup/text fields requires the field to be
    // indexed in SharePoint for reliable filtering at scale — worth
    // checking that once the real list is confirmed.
    const url =
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LIST_ID}/items` +
      `?expand=fields&$filter=fields/${FIELD_CASE_NAME} eq '${encodeURIComponent(caseName)}'`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graph API request failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    const item = data.value?.[0];

    if (!item) {
      return Response.json(null);
    }

    return Response.json({
      initialDate: item.fields[FIELD_INITIAL_DATE] || null,
      mostRecent: item.fields[FIELD_MOST_RECENT] || null,
      nextDue: item.fields[FIELD_NEXT_DUE] || null,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
