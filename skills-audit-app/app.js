// ── Config (persisted in localStorage) ──
let config = JSON.parse(localStorage.getItem('skillsAuditConfig') || 'null') || {
  owner: '',
  repo: '',
  branch: 'main',
  skillsPath: 'skills-audit-app/skills'
};

let currentScope = 'global';
let currentProject = '';
let skillsCache = {};

// ── GitHub API helpers ──
const ghAPI = 'https://api.github.com';

async function ghFetch(path) {
  const url = `${ghAPI}/repos/${config.owner}/${config.repo}/contents/${path}?ref=${config.branch}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`GitHub API error: ${res.status}`);
  }
  return res.json();
}

async function ghCreateFile(path, content, message) {
  const url = `${ghAPI}/repos/${config.owner}/${config.repo}/contents/${path}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: btoa(unescape(encodeURIComponent(content))),
      branch: config.branch
    })
  });
  if (!res.ok) throw new Error(`Failed to create file: ${res.status}`);
  return res.json();
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  if (config.owner && config.repo) {
    document.getElementById('repoOwner').value = config.owner;
    document.getElementById('repoName').value = config.repo;
    document.getElementById('repoBranch').value = config.branch;
    document.getElementById('skillsPath').value = config.skillsPath;
    connectRepo();
  }
});

function connectRepo() {
  config.owner = document.getElementById('repoOwner').value.trim();
  config.repo = document.getElementById('repoName').value.trim();
  config.branch = document.getElementById('repoBranch').value.trim() || 'main';
  config.skillsPath = document.getElementById('skillsPath').value.trim() || 'skills-audit-app/skills';

  if (!config.owner || !config.repo) {
    alert('Please enter repository owner and name.');
    return;
  }

  localStorage.setItem('skillsAuditConfig', JSON.stringify(config));
  document.getElementById('setupPanel').style.display = 'none';
  document.getElementById('mainUI').style.display = 'block';
  loadSkills();
}

// ── Scope switching ──
function switchScope(el) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  currentScope = el.dataset.scope;

  const projSel = document.getElementById('projectSelector');
  if (currentScope === 'projects') {
    projSel.style.display = 'flex';
    loadProjects();
  } else {
    projSel.style.display = 'none';
    document.getElementById('skillsTitle').textContent = 'Global Skills';
    loadSkills();
  }
}

// ── Load projects ──
async function loadProjects() {
  const dropdown = document.getElementById('projectDropdown');
  dropdown.innerHTML = '<option value="">— choose —</option>';

  try {
    const items = await ghFetch(`${config.skillsPath}/projects`);
    if (!items || !Array.isArray(items)) {
      document.getElementById('projectCount').textContent = '0';
      return;
    }
    const dirs = items.filter(i => i.type === 'dir');
    document.getElementById('projectCount').textContent = dirs.length;

    dirs.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.name;
      opt.textContent = d.name;
      dropdown.appendChild(opt);
    });
  } catch (err) {
    console.error('Failed to load projects:', err);
    document.getElementById('projectCount').textContent = '0';
  }
}

function loadProjectSkills() {
  currentProject = document.getElementById('projectDropdown').value;
  if (currentProject) {
    document.getElementById('skillsTitle').textContent = `Project: ${currentProject}`;
    loadSkills();
  }
}

// ── Load skills ──
async function loadSkills() {
  const list = document.getElementById('skillsList');
  list.innerHTML = '<p class="empty-state">Loading...</p>';

  let basePath;
  if (currentScope === 'global') {
    basePath = `${config.skillsPath}/global`;
  } else {
    if (!currentProject) {
      list.innerHTML = '<p class="empty-state">Select a project above.</p>';
      return;
    }
    basePath = `${config.skillsPath}/projects/${currentProject}`;
  }

  try {
    const items = await ghFetch(basePath);
    if (!items || !Array.isArray(items)) {
      list.innerHTML = '<p class="empty-state">No skills yet. Create one!</p>';
      return;
    }

    const dirs = items.filter(i => i.type === 'dir');
    if (dirs.length === 0) {
      list.innerHTML = '<p class="empty-state">No skills yet. Create one!</p>';
      return;
    }

    list.innerHTML = '';
    for (const dir of dirs) {
      const skillFile = await ghFetch(`${basePath}/${dir.name}/skill.md`);
      const content = skillFile ? atob(skillFile.content) : '';
      const desc = extractSection(content, 'Description') || 'No description';

      skillsCache[dir.name] = content;

      const item = document.createElement('div');
      item.className = 'skill-item';
      item.onclick = () => showDetail(dir.name, content);
      item.innerHTML = `
        <div class="skill-icon">${dir.name.charAt(0).toUpperCase()}</div>
        <div class="skill-info">
          <div class="skill-name">${dir.name}</div>
          <div class="skill-desc">${escapeHtml(desc)}</div>
        </div>
        <span class="skill-scope-tag ${currentScope === 'global' ? 'scope-global' : 'scope-project'}">
          ${currentScope === 'global' ? 'Global' : currentProject}
        </span>
      `;
      list.appendChild(item);
    }
  } catch (err) {
    console.error('Failed to load skills:', err);
    list.innerHTML = `<p class="empty-state">Error loading skills. Check your repo settings.</p>`;
  }
}

// ── Parse skill.md sections ──
function extractSection(md, sectionName) {
  const regex = new RegExp(`## ${sectionName}\\s*\\n(?:<!--[\\s\\S]*?-->\\s*\\n)?([\\s\\S]*?)(?=\\n## |$)`, 'i');
  const match = md.match(regex);
  if (!match) return '';
  return match[1].trim().replace(/^-\s*$/, '').replace(/^1\.\s*$/, '');
}

// ── Show detail ──
function showDetail(name, content) {
  document.getElementById('detailTitle').textContent = name;
  const sections = ['Description', 'Trigger', 'References', 'Steps', 'Notes'];
  let html = '';

  for (const sec of sections) {
    const text = extractSection(content, sec);
    if (text) {
      html += `<h2>${sec}</h2>`;
      if (sec === 'Steps') {
        const steps = text.split('\n').filter(l => l.trim());
        html += '<ol>' + steps.map(s => `<li>${escapeHtml(s.replace(/^\d+\.\s*/, ''))}</li>`).join('') + '</ol>';
      } else if (sec === 'References') {
        const refs = text.split('\n').filter(l => l.trim());
        html += '<ul>' + refs.map(r => `<li>${escapeHtml(r.replace(/^-\s*/, ''))}</li>`).join('') + '</ul>';
      } else {
        html += `<p>${escapeHtml(text)}</p>`;
      }
    }
  }

  if (!html) html = '<p class="empty-state">No content found in skill.md</p>';
  document.getElementById('detailContent').innerHTML = html;
  document.getElementById('skillDetail').style.display = 'block';
  document.getElementById('skillDetail').scrollIntoView({ behavior: 'smooth' });
}

function closeDetail() {
  document.getElementById('skillDetail').style.display = 'none';
}

// ── Create skill ──
function showNewSkillModal() {
  document.getElementById('newSkillModal').classList.add('show');
  document.getElementById('newSkillName').value = '';
  document.getElementById('newSkillDesc').value = '';
  document.getElementById('newSkillTrigger').value = '';
  document.getElementById('newSkillSteps').value = '';
  document.getElementById('newSkillRefs').value = '';
  document.getElementById('newSkillNotes').value = '';
  document.getElementById('newSkillName').focus();
}

function closeNewSkillModal() {
  document.getElementById('newSkillModal').classList.remove('show');
}

async function createSkill() {
  const name = document.getElementById('newSkillName').value.trim().toLowerCase().replace(/\s+/g, '-');
  const desc = document.getElementById('newSkillDesc').value.trim();
  const trigger = document.getElementById('newSkillTrigger').value.trim();
  const steps = document.getElementById('newSkillSteps').value.trim();
  const refs = document.getElementById('newSkillRefs').value.trim();
  const notes = document.getElementById('newSkillNotes').value.trim();

  if (!name || !desc || !trigger) {
    alert('Name, Description, and Trigger are required.');
    return;
  }

  let basePath;
  if (currentScope === 'global') {
    basePath = `${config.skillsPath}/global/${name}`;
  } else {
    if (!currentProject) { alert('Select a project first.'); return; }
    basePath = `${config.skillsPath}/projects/${currentProject}/${name}`;
  }

  const refsFormatted = refs ? refs.split('\n').map(r => `- ${r.trim()}`).join('\n') : '-';
  const stepsFormatted = steps ? steps.split('\n').map((s, i) => {
    return s.match(/^\d+\./) ? s.trim() : `${i + 1}. ${s.trim()}`;
  }).join('\n') : '1.';

  const content = `# ${name}

## Description
${desc}

## Trigger
${trigger}

## References
${refsFormatted}

## Steps
${stepsFormatted}

## Notes
${notes || ''}
`;

  try {
    await ghCreateFile(`${basePath}/skill.md`, content, `Add skill: ${name}`);
    closeNewSkillModal();
    loadSkills();
  } catch (err) {
    alert(`Failed to create skill: ${err.message}\n\nNote: Creating skills via the Web UI requires a GitHub token. For now, create skills by committing files directly.`);
    console.error(err);
  }
}

// ── Create project ──
function showNewProjectModal() {
  document.getElementById('newProjectModal').classList.add('show');
  document.getElementById('newProjectName').value = '';
  document.getElementById('newProjectName').focus();
}

function closeNewProjectModal() {
  document.getElementById('newProjectModal').classList.remove('show');
}

async function createProject() {
  const name = document.getElementById('newProjectName').value.trim().toLowerCase().replace(/\s+/g, '-');
  if (!name) { alert('Enter a project name.'); return; }

  try {
    await ghCreateFile(
      `${config.skillsPath}/projects/${name}/.gitkeep`,
      '',
      `Create project: ${name}`
    );
    closeNewProjectModal();
    loadProjects();
  } catch (err) {
    alert(`Failed to create project: ${err.message}`);
  }
}

// ── Utility ──
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
