// Assembles the Competitive Edge Campaign Builder workflow JSON from the
// individual Code-node bodies, prompt files and schema examples in this folder.
// Run:  node build_workflow.js   ->  competitive_edge_campaign.workflow.json
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const code = (f) => fs.readFileSync(path.join(HERE, 'code', f), 'utf8');
const prompt = (f) => '=' + fs.readFileSync(path.join(HERE, 'prompts', f), 'utf8');
const schema = (f) => fs.readFileSync(path.join(HERE, 'schemas', f), 'utf8');

let X = 0;
const col = () => { X += 240; return X; };
const LITE = !!process.env.LITE; // stub big jsCode strings so the workflow can be validated cheaply
const codeNode = (name, file, y = 300) => ({
  name, type: 'n8n-nodes-base.code', typeVersion: 2, position: [col(), y],
  parameters: { mode: 'runOnceForAllItems', jsCode: LITE ? '// stub\nreturn $input.all();' : code(file) },
});
const httpNode = (name, params, y = 300) => ({
  name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [col(), y],
  parameters: params,
  onError: 'continueRegularOutput', retryOnFail: true, maxTries: 2, waitBetweenTries: 1500,
  alwaysOutputData: true,
});

const UA = 'CompetitiveEdgeBot/1.0 (+https://n8n.io; contact: sales-demo)';
const textFetch = (urlExpr) => ({
  method: 'GET', url: urlExpr,
  sendHeaders: true,
  headerParameters: { parameters: [{ name: 'User-Agent', value: UA }] },
  options: { timeout: 12000, response: { response: { responseFormat: 'text', neverError: true } } },
});

const chain = (name, promptFile, y = 300) => ({
  name, type: '@n8n/n8n-nodes-langchain.chainLlm', typeVersion: 1.9, position: [col(), y],
  parameters: { promptType: 'define', text: prompt(promptFile), hasOutputParser: true },
});
const parser = (name, schemaFile, x, y) => ({
  name, type: '@n8n/n8n-nodes-langchain.outputParserStructured', typeVersion: 1.3, position: [x, y],
  parameters: { schemaType: 'fromJson', jsonSchemaExample: schema(schemaFile) },
});

// ---- nodes in main-flow order (col() advances X left→right) ----------------
const form = {
  name: 'Campaign Request Form', type: 'n8n-nodes-base.formTrigger', typeVersion: 2.6, position: [col(), 300],
  parameters: {
    path: 'competitive-edge',
    formTitle: 'Competitive Edge — Campaign Builder',
    formDescription: 'Enter a company and get a competitor gap analysis plus a ready-to-post ad campaign, emailed to you within a few minutes.',
    formFields: { values: [
      { fieldLabel: 'Company website URL', placeholder: 'https://example.com', requiredField: true },
      { fieldLabel: 'Company name', placeholder: '(optional) leave blank to auto-detect', requiredField: false },
      { fieldLabel: 'Target audience', fieldType: 'textarea', placeholder: '(optional) who the campaign should speak to', requiredField: false },
      { fieldLabel: 'Your name / brand', placeholder: "(optional) shown as 'prepared by'", requiredField: false },
      { fieldLabel: 'Notify email', fieldType: 'email', placeholder: 'where to send the report', requiredField: false },
    ] },
    responseMode: 'onReceived',
    options: { formSubmittedText: 'Thanks! Your Competitive Edge report is being generated and will land in your inbox in a few minutes.' },
  },
};

const normalize = codeNode('Normalize Input', 'normalize_input.js');
const fetchCompany = httpNode('Fetch Company Site', textFetch('={{ $json.companyUrl }}'));
const cleanCompany = codeNode('Clean Company Text', 'clean_company.js');
const profile = chain('Company Profile', 'company_profile.txt');
// Keyless web search via DuckDuckGo's HTML endpoint (no API key / signup).
const serp = httpNode('DuckDuckGo Search', {
  method: 'GET', url: 'https://html.duckduckgo.com/html/',
  sendQuery: true,
  queryParameters: { parameters: [{ name: 'q', value: '={{ $json.output.search_query }}' }] },
  sendHeaders: true,
  headerParameters: { parameters: [
    { name: 'User-Agent', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
    { name: 'Accept-Language', value: 'en-US,en;q=0.9' },
  ] },
  options: { timeout: 15000, response: { response: { responseFormat: 'text', neverError: true } } },
});
const extract = codeNode('Extract Competitors', 'extract_competitors.js');
const fetchComp = httpNode('Fetch Competitor Site', textFetch("={{ $json.url || 'https://example.com' }}"));
const cleanComp = codeNode('Clean Competitor Text', 'clean_competitor.js');
const aggregate = codeNode('Aggregate Context', 'aggregate_context.js');
const gap = chain('Gap Analysis', 'gap_analysis.txt');
const campaign = chain('Campaign Copy', 'campaign.txt');
const assemble = codeNode('Assemble Report', 'assemble_report.js');
// Render the full designed report HTML to a PDF via a free HTML→PDF API (PDFShift).
// Basic-auth credential = the free API key as the username.
const renderPdf = {
  name: 'Render PDF', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [col(), 300],
  parameters: {
    method: 'POST',
    url: 'https://api.pdfshift.io/v3/convert/pdf',
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth', // PDFShift: Header Auth credential -> Name: X-API-Key, Value: <key>
    sendBody: true,
    specifyBody: 'json',
    jsonBody: '={{ JSON.stringify({ source: $json.reportHtml, use_print: true, landscape: false }) }}',
    options: { timeout: 60000, response: { response: { responseFormat: 'file', outputPropertyName: 'data' } } },
  },
  retryOnFail: true, maxTries: 2, waitBetweenTries: 2000,
};
const namePdf = codeNode('Name PDF', 'name_pdf.js');
const gmail = {
  name: 'Email Report', type: 'n8n-nodes-base.gmail', typeVersion: 2.2, position: [col(), 300],
  parameters: {
    resource: 'message', operation: 'send',
    sendTo: "={{ $('Assemble Report').item.json.to }}",
    subject: "={{ $('Assemble Report').item.json.subject }}",
    emailType: 'html',
    message: "={{ $('Assemble Report').item.json.summaryHtml }}",
    options: {
      appendAttribution: false,
      attachmentsUi: { attachmentsBinary: [{ property: 'data' }] },
    },
  },
};

// ---- AI sub-nodes (placed on a lower row under their chains) ----------------
// Free-tier LLM: Google Gemini (Google AI Studio key — no card/phone).
const model = {
  name: 'Gemini', type: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini', typeVersion: 1.1,
  position: [profile.position[0] + 120, 560],
  parameters: { modelName: 'models/gemini-2.5-flash', options: { maxOutputTokens: 4096, temperature: 0.4 } },
};
const profileSchema = parser('Profile Schema', 'profile.example.json', profile.position[0], 520);
const analysisSchema = parser('Analysis Schema', 'gap.example.json', gap.position[0], 520);
const campaignSchema = parser('Campaign Schema', 'campaign.example.json', campaign.position[0], 520);

const nodes = [
  form, normalize, fetchCompany, cleanCompany, profile, serp, extract,
  fetchComp, cleanComp, aggregate, gap, campaign, assemble, renderPdf, namePdf, gmail,
  model, profileSchema, analysisSchema, campaignSchema,
];

// ---- connections -----------------------------------------------------------
const M = (to) => [[{ node: to, type: 'main', index: 0 }]];
const connections = {
  'Campaign Request Form': { main: M('Normalize Input') },
  'Normalize Input': { main: M('Fetch Company Site') },
  'Fetch Company Site': { main: M('Clean Company Text') },
  'Clean Company Text': { main: M('Company Profile') },
  'Company Profile': { main: M('DuckDuckGo Search') },
  'DuckDuckGo Search': { main: M('Extract Competitors') },
  'Extract Competitors': { main: M('Fetch Competitor Site') },
  'Fetch Competitor Site': { main: M('Clean Competitor Text') },
  'Clean Competitor Text': { main: M('Aggregate Context') },
  'Aggregate Context': { main: M('Gap Analysis') },
  'Gap Analysis': { main: M('Campaign Copy') },
  'Campaign Copy': { main: M('Assemble Report') },
  'Assemble Report': { main: M('Render PDF') },
  'Render PDF': { main: M('Name PDF') },
  'Name PDF': { main: M('Email Report') },
  'Gemini': { ai_languageModel: [[
    { node: 'Company Profile', type: 'ai_languageModel', index: 0 },
    { node: 'Gap Analysis', type: 'ai_languageModel', index: 0 },
    { node: 'Campaign Copy', type: 'ai_languageModel', index: 0 },
  ]] },
  'Profile Schema': { ai_outputParser: [[{ node: 'Company Profile', type: 'ai_outputParser', index: 0 }]] },
  'Analysis Schema': { ai_outputParser: [[{ node: 'Gap Analysis', type: 'ai_outputParser', index: 0 }]] },
  'Campaign Schema': { ai_outputParser: [[{ node: 'Campaign Copy', type: 'ai_outputParser', index: 0 }]] },
};

const workflow = {
  name: 'Competitive Edge Campaign Builder',
  nodes,
  connections,
  settings: { executionOrder: 'v1' },
};

const out = path.join(HERE, LITE ? 'competitive_edge_campaign.lite.json' : 'competitive_edge_campaign.workflow.json');
fs.writeFileSync(out, JSON.stringify(workflow, null, 2));
console.log('Wrote', out, '(' + nodes.length + ' nodes)');
