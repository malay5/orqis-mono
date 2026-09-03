/**
 * orqis-intake — Google Apps Script Web App
 * Receives form submissions from orqis.xyz and writes rows into the bound
 * Google Sheet. Deploy as: Web app · Execute as Me · Who has access Anyone.
 *
 * Expected POST body (application/json):
 *   { action: "waitlist" | "list-agent", ...fields }
 *
 * Response:
 *   { ok: true } on success
 *   { ok: false, error: "..." } on validation/runtime failure
 */

const SHEETS = {
  'waitlist': {
    name: 'Waitlist',
    headers: [
      'submittedAt',
      'email',
      'name',
      'role',
      'referrer',
      'userAgent',
    ],
  },
  'list-agent': {
    name: 'AgentSubmissions',
    headers: [
      'submittedAt',
      'contactEmail',
      'contactName',
      'agentName',
      'description',
      'endpointUrl',
      'pricingIdea',
      'links',
      'userAgent',
    ],
  },
};

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return _json({ ok: false, error: 'No body received.' });
    }

    var body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (err) {
      return _json({ ok: false, error: 'Body was not valid JSON.' });
    }

    var action = String(body.action || '').toLowerCase();
    var config = SHEETS[action];
    if (!config) {
      return _json({ ok: false, error: 'Unknown action: ' + action });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(config.name);
    if (!sheet) {
      sheet = ss.insertSheet(config.name);
    }

    // Ensure headers are present on first run.
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, config.headers.length).setValues([config.headers]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, config.headers.length).setFontWeight('bold');
    }

    var row = config.headers.map(function (h) {
      var v = body[h];
      if (v === undefined || v === null) return '';
      return String(v);
    });
    sheet.appendRow(row);

    return _json({ ok: true });
  } catch (err) {
    return _json({ ok: false, error: 'Internal error: ' + (err && err.message ? err.message : err) });
  }
}

// GET hits the deployed URL in a browser — useful as a quick sanity check.
function doGet() {
  return _json({
    ok: true,
    service: 'orqis-intake',
    endpoints: ['POST /exec  with body { action: "waitlist" | "list-agent", ... }'],
  });
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
