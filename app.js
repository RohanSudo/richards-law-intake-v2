// Richards & Law - Case Intake Portal
// ====================================

const UPLOAD_WEBHOOK = 'https://auto.brandjetmedia.com/webhook/police-report-upload';
const APPROVE_WEBHOOK = 'https://auto.brandjetmedia.com/webhook/approve-matter';

// ---- DOM Helpers ----
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ---- State ----
let selectedFile = null;
let extractedData = null;

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  initUpload();
  initTabs();
  initVerify();
  initProcessing();
});

// ============================
// STATE 1: UPLOAD
// ============================
function initUpload() {
  const dropZone = $('#drop-zone');
  const fileInput = $('#file-input');
  const btnUpload = $('#btn-upload');
  const btnRemove = $('#btn-remove');

  // Click to browse
  dropZone.addEventListener('click', () => fileInput.click());

  // File input change
  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) selectFile(e.target.files[0]);
  });

  // Drag and drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      selectFile(file);
    }
  });

  // Remove file
  btnRemove.addEventListener('click', (e) => {
    e.stopPropagation();
    clearFile();
  });

  // Upload button
  btnUpload.addEventListener('click', uploadFile);
}

function selectFile(file) {
  selectedFile = file;
  $('#file-name').textContent = file.name;
  $('#file-info').hidden = false;
  $('#drop-zone').hidden = true;
  $('#btn-upload').disabled = false;
}

function clearFile() {
  selectedFile = null;
  $('#file-input').value = '';
  $('#file-info').hidden = true;
  $('#drop-zone').hidden = false;
  $('#btn-upload').disabled = true;
}

async function uploadFile() {
  if (!selectedFile) return;

  const email = $('#upload-email').value.trim();
  if (!email) {
    alert('Please enter a client email address.');
    $('#upload-email').focus();
    return;
  }

  const btn = $('#btn-upload');
  const label = btn.querySelector('.btn-label');
  const loading = btn.querySelector('.btn-loading');
  const progress = $('#upload-progress');

  // Show loading
  btn.disabled = true;
  label.hidden = true;
  loading.hidden = false;
  progress.hidden = false;

  const formData = new FormData();
  formData.append('file', selectedFile);
  formData.append('client_email', $('#upload-email').value);

  try {
    const res = await fetch(UPLOAD_WEBHOOK, { method: 'POST', body: formData });
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    const data = await res.json();
    extractedData = data;
    populateVerifyForm(data);
    showState('verify');
  } catch (err) {
    alert('Error extracting data: ' + err.message);
  } finally {
    btn.disabled = false;
    label.hidden = false;
    loading.hidden = true;
    progress.hidden = true;
  }
}

// ============================
// TABS
// ============================
function initTabs() {
  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.tab').forEach(t => t.classList.remove('active'));
      $$('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      $(`#tab-${tab.dataset.tab}`).classList.add('active');
    });
  });
}

// ============================
// STATE 2: VERIFY
// ============================
function initVerify() {
  $('#btn-back').addEventListener('click', () => {
    showState('upload');
    clearFile();
  });

  // Auto-calculate SOL date when accident date changes
  $('#f-accident-date').addEventListener('change', () => {
    const accDate = $('#f-accident-date').value;
    if (accDate) {
      const d = new Date(accDate);
      d.setFullYear(d.getFullYear() + 8);
      $('#f-sol-date').value = d.toISOString().split('T')[0];
    }
  });

  $('#btn-approve').addEventListener('click', approveCase);
}

function populateVerifyForm(data) {
  $$('[data-field]').forEach(el => {
    const key = el.dataset.field;
    if (data[key] !== undefined && data[key] !== null) {
      el.value = String(data[key]);
    }
  });
}

function gatherFormData() {
  const out = {};
  $$('[data-field]').forEach(el => {
    out[el.dataset.field] = el.value;
  });
  return out;
}

async function approveCase() {
  const btn = $('#btn-approve');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Submitting...';

  const payload = gatherFormData();
  const clientName = `${payload.client_first_name} ${payload.client_last_name}`;

  showState('processing');
  runProcessing(payload, clientName);
}

// ============================
// STATE 3: PROCESSING
// ============================

const STEP_LABELS = [
  'Searching for contact in Clio',
  'Updating contact information',
  'Searching for existing matter',
  'Updating matter with custom fields',
  'Creating statute of limitations calendar entry',
  'Generating retainer agreement',
  'Sending retainer to client via email'
];

const STEP_DELAYS = [1200, 1800, 1500, 2500, 2000, 3000, 2500];
const TOTAL_STEPS = STEP_LABELS.length;

function initProcessing() {
  $('#btn-new-case').addEventListener('click', () => {
    resetProcessing();
    showState('upload');
    clearFile();
    // Reset approve button
    const btn = $('#btn-approve');
    btn.disabled = false;
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Approve &amp; Process Case`;
  });
}

function resetProcessing() {
  $$('.step-icon').forEach(icon => {
    icon.className = 'step-icon pending';
  });
  $$('.step').forEach(s => s.classList.remove('active', 'done'));
  $('#proc-progress-fill').style.width = '0%';
  $('#proc-percent').textContent = '0%';
  $('#result-box').hidden = true;
  $('#result-box').className = 'result-box';
  $('#btn-new-case').hidden = true;
  $('#processing-title').textContent = 'Processing case...';
  $('#processing-subtitle').textContent = 'Setting up the matter in Clio and generating documents.';
}

async function runProcessing(payload, clientName) {
  resetProcessing();
  $('#processing-title').textContent = `Processing case for ${clientName}`;

  // Start the actual API call in background
  let apiDone = false;
  let apiResult = null;
  let apiError = null;

  const apiPromise = fetch(APPROVE_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(async res => {
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
    apiDone = true;
    apiResult = data;
    return data;
  }).catch(err => {
    apiDone = true;
    apiError = err;
    throw err;
  });

  // Animate steps
  for (let i = 0; i < TOTAL_STEPS; i++) {
    const step = $(`.step[data-step="${i}"]`);
    const icon = step.querySelector('.step-icon');
    step.classList.add('active');
    icon.className = 'step-icon active';

    const pct = Math.round(((i) / TOTAL_STEPS) * 100);
    $('#proc-progress-fill').style.width = pct + '%';
    $('#proc-percent').textContent = pct + '%';

    await sleep(STEP_DELAYS[i]);

    icon.className = 'step-icon done';
    step.classList.remove('active');
    step.classList.add('done');
  }

  // Animation done - set to 95% if API not done yet
  if (!apiDone) {
    $('#proc-progress-fill').style.width = '95%';
    $('#proc-percent').textContent = '95%';
    $('#processing-subtitle').textContent = 'Finalizing - waiting for server confirmation...';

    // Keep last step pulsing
    const lastStep = $(`.step[data-step="${TOTAL_STEPS - 1}"]`);
    const lastIcon = lastStep.querySelector('.step-icon');
    lastStep.classList.add('active');
    lastStep.classList.remove('done');
    lastIcon.className = 'step-icon active';
  }

  // Wait for actual API response
  try {
    const data = await apiPromise;
    // Mark last step done if it was still active
    const lastStep = $(`.step[data-step="${TOTAL_STEPS - 1}"]`);
    const lastIcon = lastStep.querySelector('.step-icon');
    lastIcon.className = 'step-icon done';
    lastStep.classList.remove('active');
    lastStep.classList.add('done');

    $('#proc-progress-fill').style.width = '100%';
    $('#proc-percent').textContent = '100%';
    showResult('success', clientName, data);
  } catch (err) {
    $('#proc-progress-fill').style.width = '100%';
    $('#proc-percent').textContent = '100%';
    showResult('error', clientName, apiError || err);
  }
}

function showResult(type, clientName, data) {
  const box = $('#result-box');
  box.hidden = false;

  if (type === 'success') {
    box.className = 'result-box success';
    $('#result-icon').textContent = '\u2705';
    $('#result-text').textContent = 'Case processed successfully';
    $('#result-details').textContent = `Matter ID: ${data.matter_id || 'N/A'} | Contact ID: ${data.contact_id || 'N/A'}`;
    $('#processing-title').textContent = `Case processed for ${clientName}`;
    $('#processing-subtitle').textContent = 'Retainer agreement sent. All records updated in Clio.';
  } else {
    box.className = 'result-box error';
    $('#result-icon').textContent = '\u274C';
    $('#result-text').textContent = 'An error occurred';
    $('#result-details').textContent = data.message || 'Unknown error';
    $('#processing-title').textContent = `Error processing case for ${clientName}`;
    $('#processing-subtitle').textContent = 'Please check the error below and try again.';

    // Mark last non-done step as error
    const steps = $$('.step-icon');
    for (let i = steps.length - 1; i >= 0; i--) {
      if (!steps[i].classList.contains('done')) {
        steps[i].className = 'step-icon error';
        break;
      }
    }
  }

  $('#btn-new-case').hidden = false;
}

// ============================
// UTILITIES
// ============================
function showState(name) {
  $$('.state').forEach(s => s.classList.remove('active'));
  $(`#state-${name}`).classList.add('active');
  window.scrollTo(0, 0);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
