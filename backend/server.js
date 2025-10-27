const express = require("express");
const fs = require("fs").promises;
const cors = require("cors");
const path = require("path");
const axios = require("axios");
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3001;
const ACCOUNTS_FILE = path.join(__dirname, "accounts.json");
const BREVO_BASE_URL = "https://api.brevo.com/v3";

app.use(cors());
app.use(express.json());

// Helper function for Brevo API
const getBrevoApiClient = (apiKey) => {
    if (!apiKey) {
        throw new Error("Brevo API Key is missing.");
    }
    return axios.create({
        baseURL: BREVO_BASE_URL,
        headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    });
};

// Read/Write Accounts functions
const readAccounts = async () => {
  try {
    const data = await fs.readFile(ACCOUNTS_FILE, "utf-8");
    try {
        const accounts = JSON.parse(data);
        return Array.isArray(accounts) ? accounts.map(({ id, name, apiKey }) => ({ id, name, apiKey })) : [];
    } catch (parseError) {
        console.error("Error parsing accounts.json:", parseError);
        return [];
    }
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    console.error("Error reading accounts file:", error);
    return [];
  }
};
const writeAccounts = async (accounts) => {
  const accountsToWrite = accounts.map(({ id, name, apiKey }) => ({ id, name, apiKey }));
  try {
      await fs.writeFile(ACCOUNTS_FILE, JSON.stringify(accountsToWrite, null, 2));
  } catch (error) {
      console.error("Error writing accounts file:", error);
      throw error;
  }
};

// --- Account Management Endpoints ---
app.get("/api/accounts", async (req, res) => {
  try {
    const accounts = await readAccounts();
    res.json(accounts);
  } catch (error) { console.error("GET /api/accounts error:", error); res.status(500).json({ error: "Failed to read accounts" }); }
});
app.post("/api/accounts", async (req, res) => {
  try {
    const { name, apiKey } = req.body;
    if (!name || !apiKey) return res.status(400).json({ error: "Name and apiKey required" });
    const accounts = await readAccounts();
    const newAccount = { id: `acc_${Date.now()}_${uuidv4().substring(0, 4)}`, name, apiKey };
    accounts.push(newAccount); await writeAccounts(accounts); res.status(201).json(newAccount);
  } catch (error) { console.error("POST /api/accounts error:", error); res.status(500).json({ error: "Failed to save account" }); }
});
app.put("/api/accounts/:id", async (req, res) => {
    try {
        const { id } = req.params; const { name, apiKey } = req.body;
        if (!name || !apiKey) return res.status(400).json({ error: "Name and apiKey required" });
        const accounts = await readAccounts(); const accountIndex = accounts.findIndex(acc => acc.id === id);
        if (accountIndex === -1) return res.status(404).json({ error: "Account not found" });
        accounts[accountIndex] = { ...accounts[accountIndex], name, apiKey }; await writeAccounts(accounts); res.json(accounts[accountIndex]);
    } catch (error) { console.error(`PUT /api/accounts/${req.params.id} error:`, error); res.status(500).json({ error: "Failed to update account" }); }
});
app.delete("/api/accounts/:id", async (req, res) => {
    try {
        const { id } = req.params; let accounts = await readAccounts(); const initialLength = accounts.length;
        const updatedAccounts = accounts.filter(acc => acc.id !== id);
        if (updatedAccounts.length === initialLength) return res.status(404).json({ error: "Account not found" });
        await writeAccounts(updatedAccounts); res.status(200).json({ message: "Account deleted successfully" });
    } catch (error) { console.error(`DELETE /api/accounts/${req.params.id} error:`, error); res.status(500).json({ error: "Failed to delete account" }); }
});
app.post("/api/accounts/check-status", async (req, res) => {
  const { apiKey } = req.body; if (!apiKey) return res.status(400).json({ status: 'failed', response: { message: "API Key required" } });
  try {
    const apiClient = getBrevoApiClient(apiKey); console.log("[API /api/accounts/check-status] Calling Brevo: GET /account");
    const response = await apiClient.get('/account'); console.log(`[API /api/accounts/check-status] Brevo API Response Status: ${response.status}`);
    res.json({ status: 'connected', response: response.data });
  } catch (error) {
    const errorStatus = error.response?.status || 500; const errorDetails = error.response?.data || { message: error.message };
    const status = errorStatus === 401 ? 'failed' : 'failed'; console.error(`[API /api/accounts/check-status] Failed: Status=${errorStatus}`, JSON.stringify(errorDetails, null, 2));
    res.status(errorStatus).json({ status: status, response: errorDetails });
  }
});

// --- Sender Management Endpoints ---
app.post("/api/brevo/senders", async (req, res) => {
    const { apiKey } = req.body; if (!apiKey) return res.status(400).json({ error: "API Key required" });
    try {
        const apiClient = getBrevoApiClient(apiKey); console.log("[API /api/brevo/senders] Calling Brevo: GET /senders");
        const response = await apiClient.get('/senders'); console.log(`[API /api/brevo/senders] Brevo API Response Status: ${response.status}`);
        if (response.data && Array.isArray(response.data.senders)) {
             const senders = response.data.senders.map(s => ({ id: s.id, name: s.name, email: s.email, active: s.active })); console.log(`[API /api/brevo/senders] Success: Found ${senders.length} senders.`); res.json(senders);
        } else { console.error("[API /api/brevo/senders] Unexpected response format:", response.data); res.status(500).json({ error: "Unexpected response fetching senders."}); }
    } catch (error) {
        const errorStatus = error.response?.status || 500; const errorDetails = error.response?.data || { message: error.message };
        console.error(`[API /api/brevo/senders] Failed: Status=${errorStatus}`, JSON.stringify(errorDetails, null, 2)); res.status(errorStatus).json({ error: `Failed fetch senders (Status: ${errorStatus})`, details: errorDetails });
    }
});
app.put("/api/brevo/senders/:senderId", async (req, res) => {
    const { apiKey, newSenderName } = req.body; const { senderId } = req.params;
    if (!apiKey || !newSenderName || !senderId) return res.status(400).json({ error: "apiKey, newSenderName, senderId required." });
    try {
        const apiClient = getBrevoApiClient(apiKey); const payload = { name: newSenderName }; console.log(`[API /api/brevo/senders/:senderId] Calling Brevo: PUT /senders/${senderId}`);
        const response = await apiClient.put(`/senders/${senderId}`, payload); console.log(`[API /api/brevo/senders/:senderId] Brevo API Response Status: ${response.status}`); res.status(204).send();
    } catch (error) {
        const errorStatus = error.response?.status || 500; const errorDetails = error.response?.data || { message: error.message };
        console.error(`[API /api/brevo/senders/:senderId] Failed: Status=${errorStatus}`, JSON.stringify(errorDetails, null, 2)); res.status(errorStatus).json({ error: `Failed update sender (Status: ${errorStatus})`, details: errorDetails });
    }
});

// --- List & Contact Endpoints ---
app.post("/api/brevo/lists", async (req, res) => {
    const { apiKey } = req.body; if (!apiKey) return res.status(400).json({ error: "API Key required" });
    try {
        const apiClient = getBrevoApiClient(apiKey); console.log("[API /api/brevo/lists] Calling Brevo: GET /contacts/lists with limit=50");
        const response = await apiClient.get('/contacts/lists', { params: { limit: 50 } }); console.log(`[API /api/brevo/lists] Brevo API Response Status: ${response.status}`);
        if (response.data && Array.isArray(response.data.lists)) {
             const lists = response.data.lists.map((l) => ({ id: l.id, name: l.name })); console.log(`[API /api/brevo/lists] Success: Found ${lists.length} lists.`); res.json(lists);
        } else { console.error("[API /api/brevo/lists] Unexpected response format:", response.data); res.status(500).json({ error: "Unexpected response fetching lists."}); }
    } catch (error) {
        const errorStatus = error.response?.status || 500; const errorDetails = error.response?.data || { message: error.message };
        console.error(`[API /api/brevo/lists] Failed: Status=${errorStatus}`, JSON.stringify(errorDetails, null, 2)); res.status(errorStatus).json({ error: `Failed fetch lists (Status: ${errorStatus})`, details: errorDetails });
    }
});
app.post("/api/brevo/contact", async (req, res) => {
    const { apiKey, contact, listId } = req.body; if (!apiKey || !contact || !listId || !contact.email) return res.status(400).json({ error: "apiKey, contact(with email), listId required." });
    try {
        const apiClient = getBrevoApiClient(apiKey); const contactPayload = { email: contact.email, attributes: {}, listIds: [parseInt(listId, 10)], updateEnabled: false };
        if (contact.firstName) contactPayload.attributes.FIRSTNAME = contact.firstName; if (contact.lastName) contactPayload.attributes.LASTNAME = contact.lastName;
        console.log(`[API /api/brevo/contact] Calling Brevo: POST /contacts for ${contact.email}`); const response = await apiClient.post(`/contacts`, contactPayload); console.log(`[API /api/brevo/contact] Brevo Response Status for ${contact.email}: ${response.status}`);
        if (response.status === 201) { res.status(response.status).json(response.data); } else { throw { response: { data: response.data || { message: "Unexpected success status" }, status: 500 } }; }
    } catch (error) {
         const errorStatus = error.response?.status || 500; const errorDetails = error.response?.data || { message: error.message };
         console.error(`[API /api/brevo/contact] Failed for ${contact.email}: Status=${errorStatus}`, JSON.stringify(errorDetails, null, 2)); const errorMessage = errorDetails.data?.message || errorDetails.data?.code || (typeof errorDetails.data === 'string' ? errorDetails.data : null) || errorDetails.message || "Failed import"; res.status(errorStatus).json({ error: errorMessage, details: errorDetails.data });
    }
});
app.post("/api/brevo/list-contacts", async (req, res) => {
    const { apiKey, listId, page, perPage } = req.body; if (!apiKey || !listId || page === undefined || !perPage) return res.status(400).json({ error: "apiKey, listId, page, perPage required." });
    const limit = parseInt(perPage, 10); const offset = (parseInt(page, 10) - 1) * limit; if (isNaN(limit) || isNaN(offset) || limit <= 0 || offset < 0) return res.status(400).json({ error: "Invalid page/perPage." });
    try {
        const apiClient = getBrevoApiClient(apiKey); console.log(`[API /api/brevo/list-contacts] Calling Brevo: GET /contacts/lists/${listId}/contacts with limit=${limit}, offset=${offset}`);
        const response = await apiClient.get(`/contacts/lists/${listId}/contacts`, { params: { limit, offset } }); console.log(`[API /api/brevo/list-contacts] Brevo API Response Status: ${response.status}`);
        if (response.data && response.data.contacts !== undefined && response.data.count !== undefined) {
             console.log(`[API /api/brevo/list-contacts] Success: Found ${response.data.contacts.length} contacts (Total: ${response.data.count})`); res.json({ contacts: response.data.contacts, total: response.data.count });
        } else { console.error("[API /api/brevo/list-contacts] Unexpected response structure:", response.data); res.json({ contacts: [], total: 0 }); }
    } catch (error) {
        const errorStatus = error.response?.status || 500; const errorData = error.response?.data || { message: error.message };
        console.error(`[API /api/brevo/list-contacts] Failed for list ${listId}: Status=${errorStatus}`, JSON.stringify(errorData, null, 2)); res.status(errorStatus).json({ error: `Failed fetch contacts (Status: ${errorStatus})`, details: errorData });
    }
});
app.post("/api/brevo/delete-contacts", async (req, res) => {
    const { apiKey, emails } = req.body; if (!apiKey || !Array.isArray(emails) || emails.length === 0) return res.status(400).json({ error: "apiKey and emails array required." });
    const apiClient = getBrevoApiClient(apiKey); const results = { success: [], failed: [] }; console.log(`[API /api/brevo/delete-contacts] Attempting to delete ${emails.length} contacts.`);
    for (const email of emails) {
        try {
            const identifier = encodeURIComponent(email); console.log(`[API /api/brevo/delete-contacts] Calling Brevo: DELETE /contacts/${identifier}`);
            const response = await apiClient.delete(`/contacts/${identifier}`); console.log(`[API /api/brevo/delete-contacts] Brevo Response Status for ${email}: ${response.status}`);
            if (response.status === 204) { results.success.push(email); } else { results.failed.push({ email: email, reason: `Unexpected status ${response.status}` }); }
        } catch (error) {
            const errorDetails = error.response ? { status: error.response.status, data: error.response.data } : { message: error.message }; console.error(`[API /api/brevo/delete-contacts] Failed for ${email}: Status=${errorDetails.status || 'N/A'}`, JSON.stringify(errorDetails.data || errorDetails.message, null, 2));
            const reason = errorDetails.data?.message || errorDetails.message || `Status ${errorDetails.status || 'unknown'}`; results.failed.push({ email: email, reason: reason });
        }
    }
    console.log(`[API /api/brevo/delete-contacts] Deletion results:`, results);
    if (results.failed.length > 0 && results.success.length === 0) { res.status(500).json({ message: "Failed delete all", details: results }); } else if (results.failed.length > 0) { res.status(207).json({ message: "Some failed", details: results }); } else { res.status(200).json({ message: "Success", details: results }); }
});

// --- SMTP Statistics Endpoints ---
app.post("/api/brevo/smtp-stats/aggregated", async (req, res) => {
    const { apiKey, days, startDate, endDate, tag } = req.body; if (!apiKey) return res.status(400).json({ error: "API Key required" });
    try {
        const apiClient = getBrevoApiClient(apiKey); const params = {}; if (days) params.days = days; if (startDate) params.startDate = startDate; if (endDate) params.endDate = endDate; if (tag) params.tag = tag;
        console.log(`[API /api/brevo/smtp-stats/aggregated] Calling Brevo: GET /smtp/statistics/aggregatedReport with params:`, params); const response = await apiClient.get('/smtp/statistics/aggregatedReport', { params }); console.log(`[API /api/brevo/smtp-stats/aggregated] Brevo API Response Status: ${response.status}`);
        if (response.data && typeof response.data === 'object') { console.log("[API /api/brevo/smtp-stats/aggregated] Success."); res.json(response.data); } else { console.error("[API /api/brevo/smtp-stats/aggregated] Unexpected format:", response.data); res.status(500).json({ error: "Unexpected response for aggregated stats."}); }
    } catch (error) {
        const errorStatus = error.response?.status || 500; const errorData = error.response?.data || { message: error.message }; console.error(`[API /api/brevo/smtp-stats/aggregated] Failed: Status=${errorStatus}`, JSON.stringify(errorData, null, 2)); res.status(errorStatus).json({ error: `Failed fetch aggregated stats (Status: ${errorStatus})`, details: errorData });
    }
});
app.post("/api/brevo/smtp-stats/reports", async (req, res) => {
    const { apiKey, limit, offset, startDate, endDate, days, tag, sort } = req.body; if (!apiKey) return res.status(400).json({ error: "API Key required" });
    try {
        const apiClient = getBrevoApiClient(apiKey); const params = {}; if (limit) params.limit = limit; if (offset) params.offset = offset; if (startDate) params.startDate = startDate; if (endDate) params.endDate = endDate; if (days) params.days = days; if (tag) params.tag = tag; if (sort) params.sort = sort;
        console.log(`[API /api/brevo/smtp-stats/reports] Calling Brevo: GET /smtp/statistics/reports with params:`, params); const response = await apiClient.get('/smtp/statistics/reports', { params }); console.log(`[API /api/brevo/smtp-stats/reports] Brevo API Response Status: ${response.status}`);
        if (response.data && Array.isArray(response.data.reports)) { console.log(`[API /api/brevo/smtp-stats/reports] Success: Received ${response.data.reports.length} reports.`); res.json(response.data.reports); } else { console.error("[API /api/brevo/smtp-stats/reports] Unexpected format:", response.data); res.json([]); }
    } catch (error) {
        const errorStatus = error.response?.status || 500; const errorData = error.response?.data || { message: error.message }; console.error(`[API /api/brevo/smtp-stats/reports] Failed: Status=${errorStatus}`, JSON.stringify(errorData, null, 2)); res.status(errorStatus).json({ error: `Failed fetch daily reports (Status: ${errorStatus})`, details: errorData });
    }
});
app.post("/api/brevo/smtp-stats/events", async (req, res) => {
     const { apiKey, limit, offset, startDate, endDate, days, email, event, tags, messageId, templateId, sort } = req.body; if (!apiKey) return res.status(400).json({ error: "API Key required" });
     try {
        const apiClient = getBrevoApiClient(apiKey); const params = {}; if (limit) params.limit = limit; if (offset) params.offset = offset; if (startDate) params.startDate = startDate; if (endDate) params.endDate = endDate; if (days) params.days = days; if (email) params.email = email; if (event) params.event = event; if (tags) params.tags = tags; if (messageId) params.messageId = messageId; if (templateId) params.templateId = templateId; if (sort) params.sort = sort;
        console.log(`[API /api/brevo/smtp-stats/events] Calling Brevo: GET /smtp/statistics/events with params:`, params); const response = await apiClient.get('/smtp/statistics/events', { params }); console.log(`[API /api/brevo/smtp-stats/events] Brevo API Response Status: ${response.status}`);
        if (response.data && Array.isArray(response.data.events)) { console.log(`[API /api/brevo/smtp-stats/events] Success: Received ${response.data.events.length} events.`); res.json(response.data.events); } else { console.error("[API /api/brevo/smtp-stats/events] Unexpected format:", response.data); res.json([]); }
    } catch (error) {
        const errorStatus = error.response?.status || 500; const errorData = error.response?.data || { message: error.message }; console.error(`[API /api/brevo/smtp-stats/events] Failed: Status=${errorStatus}`, JSON.stringify(errorData, null, 2)); res.status(errorStatus).json({ error: `Failed fetch events (Status: ${errorStatus})`, details: errorData });
    }
});

// --- SMTP Template Endpoints ---
app.post("/api/brevo/templates", async (req, res) => {
    const { apiKey, templateStatus, limit, offset, sort } = req.body;
    if (!apiKey) { return res.status(400).json({ error: "API Key (apiKey) is required" }); }
    try {
        const apiClient = getBrevoApiClient(apiKey);
        const params = {
            templateStatus: templateStatus !== undefined ? templateStatus : true, // Default true
            limit: limit || 50, offset: offset || 0, sort: sort || 'desc'
        };
        console.log(`[API /api/brevo/templates] Calling Brevo: GET /smtp/templates with params:`, params);
        const response = await apiClient.get('/smtp/templates', { params });
        console.log(`[API /api/brevo/templates] Brevo API Response Status: ${response.status}`);

        if (response.data && Array.isArray(response.data.templates)) {
             console.log(`[API /api/brevo/templates] Success: Found ${response.data.templates.length} templates (Total: ${response.data.count}).`);
             res.json(response.data); // Return { templates, count }
        } else {
             console.error("[API /api/brevo/templates] Unexpected response format:", response.data);
             res.json({ templates: [], count: 0 });
        }
    } catch (error) {
        const errorStatus = error.response?.status || 500;
        const errorData = error.response?.data || { message: error.message };
        console.error(`[API /api/brevo/templates] Failed: Status=${errorStatus}`, JSON.stringify(errorData, null, 2));
        res.status(errorStatus).json({ error: `Failed to fetch templates (Status: ${errorStatus})`, details: errorData });
    }
});

app.put("/api/brevo/templates/:templateId", async (req, res) => {
    // Destructure expected fields from body
    const { apiKey, subject, sender, htmlContent } = req.body; // Expect sender as an object
    const { templateId } = req.params;

    if (!apiKey || !templateId) {
        return res.status(400).json({ error: "apiKey and templateId are required." });
    }
    
    try {
        const apiClient = getBrevoApiClient(apiKey);
        
        // *** FIX: Remove invalid TypeScript syntax ***
        const payload = {}; // Use a standard JavaScript object
        // *******************************************
        
        // Build payload dynamically based on what was sent
        if (subject !== undefined) payload.subject = subject;
        if (htmlContent !== undefined) payload.htmlContent = htmlContent;
        
        // Handle sender object correctly
        if (sender && (sender.email || sender.id)) {
             payload.sender = {};
             // Only include name if it exists AND is not an empty string
             if (sender.name !== undefined && sender.name !== "") {
                 payload.sender.name = sender.name;
             }
             // Brevo requires EITHER email OR id. Prefer email.
             if (sender.email) {
                 payload.sender.email = sender.email;
             } else if (sender.id) {
                 payload.sender.id = sender.id;
             } else {
                  // If neither email nor ID is present, we cannot update sender
                  console.warn(`[API /api/brevo/templates/:templateId] Sender object provided but missing email or id. Sender update skipped.`);
             }
        } else if (sender && sender.name !== undefined && sender.name !== "" && !sender.email && !sender.id) {
             // Case where only name might be provided (might fail, depends on Brevo)
              console.warn(`[API /api/brevo/templates/:templateId] Updating sender with name only. Brevo might require sender email or id.`);
              payload.sender = { name: sender.name };
        } else if (sender !== undefined) {
             console.warn(`[API /api/brevo/templates/:templateId] Invalid sender object received:`, sender);
             // Don't include invalid sender object in payload
        }

        // Check if payload is empty (nothing to update)
        if (Object.keys(payload).length === 0) {
            console.log(`[API /api/brevo/templates/:templateId] No valid fields provided to update for template ${templateId}.`);
            return res.status(204).send(); // Send success as nothing needed changing
        }

        console.log(`[API /api/brevo/templates/:templateId] Calling Brevo: PUT /smtp/templates/${templateId} with payload keys:`, Object.keys(payload));
        
        const response = await apiClient.put(`/smtp/templates/${templateId}`, payload);
        console.log(`[API /api/brevo/templates/:templateId] Brevo API Response Status: ${response.status}`);

        res.status(204).send(); // 204 No Content on success
        
    } catch (error) {
        const errorStatus = error.response?.status || 500;
        const errorData = error.response?.data || { message: error.message };
        console.error(`[API /api/brevo/templates/:templateId] Failed: Status=${errorStatus}`, JSON.stringify(errorData, null, 2));
        res.status(errorStatus).json({ error: `Failed to update template ${templateId} (Status: ${errorStatus})`, details: errorData });
    }
});


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});