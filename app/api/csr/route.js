// This route is the ONLY place the CSR Entra app credentials are used.
// It runs server-side (Next.js API route), never sent to the browser.
//
// Design: once a matter is linked (matters.csr_item_id is set), every read
// and write goes straight to that specific SharePoint item by ID - the one
// thing that never changes no matter what gets renamed on either side.
// Name-matching (by Title) only exists as a fallback for matters that
// haven't been linked yet.
//
// Env vars required (Vercel + .env.local):
//   CSR_TENANT_ID, CSR_CLIENT_ID, CSR_CLIENT_SECRET, CSR_SITE_ID, CSR_LIST_ID

const TENANT_ID = process.env.CSR_TENANT_ID;
const CLIENT_ID = process.env.CSR_CLIENT_ID;
const CLIENT_SECRET = process.env.CSR_CLIENT_SECRET;
const SITE_ID = process.env.CSR_SITE_ID;
const LIST_ID = process.env.CSR_LIST_ID;

// Confirmed real internal field names from the CSR Tracker list.
const FIELD_TITLE = 'Title'; // the Case Name equivalent - NOT the Matter field
const FIELD_PRACTICE_GROUP = 'Practicegroup';
const FIELD_FILE_NUMBER = 'Filenumber';
const FIELD_INITIAL_CSR = 'Initialcsr';
const FIELD_PRIOR_CSR = 'Nextcsr2';   // displays as "PriorcsrDate"
const FIELD_NEXT_CSR = 'Nextcsr1';
const FIELD_DATE_OPENED = 'Dateopened';
const FIELD_CREATED_IN_MT = 'CreatedinMT';
const FIELD_ASSIGNED_STAFF = 'Assignedstaff';
const FIELD_ASSIGNED_EMAILS = 'AssignedEmails';
const FIELD_CLOSED = 'Closed';

const INITIAL_CSR_OFFSET_DAYS = 45;

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

function shapeItem(item) {
  return {
    id: item.id,
    initialDate: item.fields[FIELD_INITIAL_CSR] || null,
    mostRecent: item.fields[FIELD_PRIOR_CSR] || null,
    nextDue: item.fields[FIELD_NEXT_CSR] || null,
    closed: !!item.fields[FIELD_CLOSED],
  };
}

// GET ?itemId=X  -> direct lookup by SharePoint item ID (preferred, used once linked)
// GET ?caseName=X -> fallback name-match by Title, only relevant before linking
export async function GET(request) {
  try {
    checkConfigured();
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('itemId');
    const caseName = searchParams.get('caseName');
    const token = await getAccessToken();

    if (itemId) {
      const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LIST_ID}/items/${itemId}?expand=fields`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Graph API request failed: ${res.status} ${text}`);
      }
      const item = await res.json();
      return Response.json(shapeItem(item));
    }

    if (!caseName) {
      return Response.json({ error: 'itemId or caseName is required' }, { status: 400 });
    }

    const url =
      `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LIST_ID}/items` +
      `?expand=fields&$filter=fields/${FIELD_TITLE} eq '${encodeURIComponent(caseName)}'`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly' },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graph API request failed: ${res.status} ${text}`);
    }
    const data = await res.json();
    const item = data.value?.[0];

    if (!item) {
      const allUrl = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LIST_ID}/items?expand=fields(select=${FIELD_TITLE})`;
      const allRes = await fetch(allUrl, {
        headers: { Authorization: `Bearer ${token}`, Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly' },
      });
      let existingValues = [];
      if (allRes.ok) {
        const allData = await allRes.json();
        existingValues = (allData.value || []).map((v) => v.fields[FIELD_TITLE]).filter(Boolean);
      }
      return Response.json({ noMatch: true, searchedFor: caseName, searchedForLength: caseName.length, existingValues });
    }

    return Response.json(shapeItem(item));
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// Creates a brand-new CSR Tracker row for a matter that doesn't exist there
// yet, flagged CreatedinMT. Returns the new item's ID - caller is responsible
// for saving that as matters.csr_item_id.
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
      [FIELD_TITLE]: caseName,
      [FIELD_PRACTICE_GROUP]: practiceGroup || null,
      [FIELD_FILE_NUMBER]: fileNumber || null,
      [FIELD_DATE_OPENED]: dateOpened,
      [FIELD_INITIAL_CSR]: initialCsr,
      [FIELD_CREATED_IN_MT]: true,
    };

    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LIST_ID}/items`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graph API create failed: ${res.status} ${text}`);
    }

    const created = await res.json();
    return Response.json({ success: true, id: created.id, initialCsr });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// One generic endpoint for every kind of update, discriminated by `action`,
// so callers (Submit CSR, Assigned Staff sync, Case Name rename, Close/Reopen)
// never need to know raw SharePoint field names - just the action and its
// own plain-language payload.
export async function PATCH(request) {
  try {
    checkConfigured();
    const body = await request.json();
    const { itemId, action, payload } = body;

    if (!itemId || !action) {
      return Response.json({ error: 'itemId and action are required' }, { status: 400 });
    }

    let fields = {};

    if (action === 'submitCsr') {
      const { priorCsrDate, nextCsrDue } = payload || {};
      if (!priorCsrDate || !nextCsrDue) {
        return Response.json({ error: 'priorCsrDate and nextCsrDue are required' }, { status: 400 });
      }
      fields = { [FIELD_PRIOR_CSR]: priorCsrDate, [FIELD_NEXT_CSR]: nextCsrDue };
    } else if (action === 'updateStaff') {
      const { staffNames, staffEmails } = payload || {};
      fields = { [FIELD_ASSIGNED_STAFF]: staffNames || '', [FIELD_ASSIGNED_EMAILS]: staffEmails || '' };
    } else if (action === 'rename') {
      const { title } = payload || {};
      if (!title) return Response.json({ error: 'title is required' }, { status: 400 });
      fields = { [FIELD_TITLE]: title };
    } else if (action === 'setClosed') {
      const { closed } = payload || {};
      fields = { [FIELD_CLOSED]: !!closed };
    } else {
      return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    const token = await getAccessToken();
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${LIST_ID}/items/${itemId}/fields`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graph API update failed: ${res.status} ${text}`);
    }

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
