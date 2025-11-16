// 🔧 CONFIG - Update these URLs!
const CONFIG = {
    MATRIX_WORKER_URL: 'https://matrix.ai-n.workers.dev',  // Your matrix worker
    SESSION_WORKER_URL: 'https://session.ai-n.workers.dev'  // Your session worker
};

let sessionId = localStorage.getItem('matrixSessionId') || `session-${Date.now()}`;
localStorage.setItem('matrixSessionId', sessionId);
document.getElementById('sessionIdDisplay').textContent = sessionId.slice(0,8);

// Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    };
});

// API Helper
async function apiCall(url, options = {}) {
    try {
        const res = await fetch(url, {
            ...options,
            headers: { 'Content-Type': 'application/json', ...options.headers }
        });
        return await res.json();
    } catch (e) { console.error(e); return { error: e.message }; }
}

// Dashboard: API Info
async function loadApiInfo() {
    const res = await fetch(`${CONFIG.MATRIX_WORKER_URL}`);
    document.getElementById('apiInfo').textContent = await res.text();
}

// Session Memory
async function loadContext() {
    const res = await apiCall(`${CONFIG.SESSION_WORKER_URL}/session/context?sessionId=${sessionId}`);
    document.getElementById('contextDisplay').textContent = JSON.stringify(res, null, 2);
}
async function clearSession() {
    await apiCall(`${CONFIG.SESSION_WORKER_URL}/session/clear`, {
        method: 'POST',
        body: JSON.stringify({ sessionId })
    });
    loadContext();
}

// AI Chat
async function sendChat() {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (!msg) return;
    addMessage('user', msg);
    input.value = '';

    const res = await apiCall(`${CONFIG.MATRIX_WORKER_URL}/ai/chat`, {
        method: 'POST',
        body: JSON.stringify({ message: msg, sessionId })
    });
    addMessage('assistant', res.response || res.error || 'Error');
}
function addMessage(role, content) {
    const msgs = document.getElementById('chatMessages');
    msgs.innerHTML += `<div class="message ${role}">${content}</div>`;
    msgs.scrollTop = msgs.scrollHeight;
}
document.getElementById('chatInput').addEventListener('keypress', e => { if (e.key === 'Enter') sendChat(); });

// Code Gen
async function generateCode() {
    const prompt = document.getElementById('codePrompt').value;
    const lang = document.getElementById('codeLang').value;
    const res = await apiCall(`${CONFIG.MATRIX_WORKER_URL}/ai/code`, {
        method: 'POST',
        body: JSON.stringify({ prompt, language: lang, sessionId })
    });
    document.querySelector('#codeOutput code').textContent = res.code || res.error || '// No code generated';
}

// Sandbox Terminal
async function runCommand() {
    const input = document.getElementById('termInput');
    const cmd = input.value.trim();
    input.value = '';

    const term = document.getElementById('terminalOutput');
    term.innerHTML += `\n$ ${cmd}\n`;
    
    let url = `${CONFIG.MATRIX_WORKER_URL}/run?code=${encodeURIComponent(cmd)}`;
    if (cmd.includes('file?action=')) url = `${CONFIG.MATRIX_WORKER_URL}${cmd}`;
    
    const res = await apiCall(url.replace('code=', ''));
    term.innerHTML += `${JSON.stringify(res, null, 2)}\n`;
    term.scrollTop = term.scrollHeight;
}

// File Upload → Session Memory
document.getElementById('fileInput').addEventListener('change', async (e) => {
    const status = document.getElementById('uploadStatus');
    status.textContent = 'Processing...';
    for (let file of Array.from(e.target.files)) {
        const text = await file.text();
        // Append to interactions as user context
        await apiCall(`${CONFIG.SESSION_WORKER_URL}/session/add-interaction`, {
            method: 'POST',
            body: JSON.stringify({
                sessionId,
                user: `CONTEXT WALL: ${file.name}\n\n${text.substring(0, 50000)}...`  // Chunk if huge
            })
        });
    }
    status.textContent = '✅ Uploaded to Session Memory! Reload context.';
    loadContext();
});

// Drag/Drop
document.querySelector('.upload-zone').addEventListener('dragover', e => e.preventDefault());
document.querySelector('.upload-zone').addEventListener('drop', e => {
    e.preventDefault();
    document.getElementById('fileInput').files = e.dataTransfer.files;
    document.getElementById('fileInput').dispatchEvent(new Event('change'));
});

// Init
loadContext();