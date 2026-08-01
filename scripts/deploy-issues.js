const fs = require('fs');
const https = require('https');
const path = require('path');

const OWNER = 'khushi897920-lang';
const REPO = 'hercycle-ai';
const token = process.env.GITHUB_TOKEN;


const ECSOC_ISSUES_PATH = path.join(__dirname, '..', 'docs', 'ECSOC_ISSUES.md');

// Map of desired issues from docs/ECSOC_ISSUES.md by original Issue Number
const BACKLOG_MAP = {
  // Frontend & UI/UX (13 issues from backlog)
  2: { category: 'Frontend', extraLabels: ['frontend'] },
  4: { category: 'Frontend', extraLabels: ['frontend'] },
  6: { category: 'Frontend', extraLabels: ['frontend'] },
  7: { category: 'Frontend', extraLabels: ['frontend'] },
  9: { category: 'Frontend', extraLabels: ['frontend'] },
  12: { category: 'Frontend', extraLabels: ['frontend'] },
  13: { category: 'Frontend', extraLabels: ['frontend'] },
  15: { category: 'Frontend', extraLabels: ['frontend'] },
  19: { category: 'Frontend', extraLabels: ['frontend'] },
  20: { category: 'Frontend', extraLabels: ['frontend'] },
  21: { category: 'Frontend', extraLabels: ['frontend'] },
  24: { category: 'Frontend', extraLabels: ['frontend'] },
  52: { category: 'Frontend', extraLabels: ['frontend'] },

  // Backend & API (10 issues from backlog)
  36: { category: 'Backend', extraLabels: ['backend'] },
  37: { category: 'Backend', extraLabels: ['backend'] },
  41: { category: 'Backend', extraLabels: ['backend'] },
  42: { category: 'Backend', extraLabels: ['backend'] },
  43: { category: 'Backend', extraLabels: ['backend'] },
  44: { category: 'Backend', extraLabels: ['backend'] },
  45: { category: 'Backend', extraLabels: ['backend'] },
  46: { category: 'Backend', extraLabels: ['backend'] },
  47: { category: 'Backend', extraLabels: ['backend'] },
  51: { category: 'Backend', extraLabels: ['backend'] },

  // Accessibility & Localization (5 issues from backlog)
  32: { category: 'Accessibility', extraLabels: ['accessibility'] },
  33: { category: 'Accessibility', extraLabels: ['accessibility'] },
  56: { category: 'Accessibility', extraLabels: ['accessibility'] },
  3: { category: 'Accessibility', extraLabels: ['accessibility', 'seo'] },
  22: { category: 'Accessibility', extraLabels: ['accessibility', 'ui'] },

  // PWA & Offline Sync (4 issues from backlog)
  59: { category: 'PWA', extraLabels: ['pwa', 'offline'] },
  34: { category: 'PWA', extraLabels: ['pwa', 'offline'] },
  60: { category: 'PWA', extraLabels: ['pwa', 'offline'] },
  26: { category: 'PWA', extraLabels: ['pwa', 'offline'] },

  // General & Quality (3 issues from backlog)
  38: { category: 'General', extraLabels: ['general'] },
  50: { category: 'General', extraLabels: ['general', 'ci-cd'] },
  48: { category: 'General', extraLabels: ['general', 'testing'] }
};

// 2 custom Frontend issues to make exactly 37 issues
const CUSTOM_ISSUES = [
  {
    title: 'Frontend: Ensure responsive button, page, and section alignment across all screen sizes',
    body: `### 📌 Description
Multiple buttons, form elements, page grids, and content sections exhibit layout wrapping, overlapping, or alignment issues when viewed on mobile screens (especially viewport widths below 375px). 

### 🎯 Objective
Review layout containers, flex wrappers, and button grids across the tracker, self-care, challenges, and onboarding pages to make sure they are perfectly centered, well-padded, and aligned on all screens.

### ✅ Acceptance Criteria
- [ ] No buttons or text containers overflow the screen boundary on any mobile breakpoint.
- [ ] Page sections maintain consistent spacing and borders.
- [ ] All elements are aligned beautifully in both English and Hindi locale modes.
- [ ] Build succeeds without lint or compile warnings.

### 📂 Expected Files
* [globals.css](file:///app/globals.css)`,
    labels: ['frontend', 'ECSoC26', 'ui', 'feature-improvement']
  },
  {
    title: 'Frontend: Relocate Challenges and Community navigation to User Profile dropdown',
    body: `### 📌 Description
The desktop and mobile navigation bars are currently cluttered with too many top-level options. To simplify the main menu and create a cleaner user experience, we want to relocate the 'Challenges' and 'Community' navigation routes into the user profile dropdown menu.

### 🎯 Objective
Relocate the 'Challenges' and 'Community' navbar link rendering logic into the profile details drawer/dropdown menu alongside 'Manage Account', 'Sign Out', and 'Notifications'.

### ✅ Acceptance Criteria
- [ ] 'Challenges' and 'Community' options are removed from the main top navigation menu.
- [ ] Both options are rendered neatly within the User Profile dropdown drawer, inheriting correct styles and icons.
- [ ] Sub-navigation links remain fully functional, pointing to correct locale routes.
- [ ] Translation support is verified for both English and Hindi languages.

### 📂 Expected Files
* [Navbar.jsx](file:///components/layout/Navbar.jsx)`,
    labels: ['frontend', 'ECSoC26', 'ui', 'feature-improvement']
  }
];

function makeRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data ? JSON.parse(data) : null
        });
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function createIssue(issue, index) {
  const options = {
    hostname: 'api.github.com',
    path: `/repos/${OWNER}/${REPO}/issues`,
    method: 'POST',
    headers: {
      'User-Agent': 'node.js',
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json'
    }
  };

  try {
    const res = await makeRequest(options, issue);
    if (res.statusCode === 201) {
      console.log(`[${index + 1}/37] \x1b[32mCreated:\x1b[0m "${issue.title}" -> ${res.data.html_url}`);
    } else {
      console.error(`[${index + 1}/37] \x1b[31mFailed:\x1b[0m "${issue.title}" - Status: ${res.statusCode}`, res.data);
    }
  } catch (err) {
    console.error(`[${index + 1}/37] \x1b[31mError:\x1b[0m "${issue.title}"`, err.message);
  }
}

function parseIssuesFromMD() {
  const content = fs.readFileSync(ECSOC_ISSUES_PATH, 'utf8');
  // Split by horizontal line divider
  const issueBlocks = content.split(/\n---\s*\n/);
  const parsedMap = {};

  for (const block of issueBlocks) {
    const issueMatch = block.match(/## Issue #(\d+):\s*(.*)/);
    if (!issueMatch) continue;

    const num = parseInt(issueMatch[1], 10);
    const title = issueMatch[2].trim();

    // Extract Description, Objective, Acceptance Criteria, Expected Files
    let body = '';
    const bodyStartIdx = block.indexOf('### 📌 Description');
    if (bodyStartIdx !== -1) {
      body = block.substring(bodyStartIdx).trim();
    }

    // Extract original labels
    const labelsMatch = block.match(/\* \*\*Labels:\*\* (.*)/);
    const parsedLabels = [];
    if (labelsMatch) {
      const labelStrings = labelsMatch[1].match(/`([^`]+)`/g) || [];
      labelStrings.forEach(l => {
        const cleanLabel = l.replace(/`/g, '');
        if (cleanLabel !== 'ECSOC') {
          parsedLabels.push(cleanLabel);
        }
      });
    }

    parsedMap[num] = {
      title,
      body,
      labels: parsedLabels
    };
  }

  return parsedMap;
}

async function run() {
  if (!token) {
    console.error('\x1b[31mError: GITHUB_TOKEN environment variable is not set.\x1b[0m');
    process.exit(1);
  }
  console.log('Parsing ECSOC_ISSUES.md...');
  const backlog = parseIssuesFromMD();
  
  const finalIssues = [];

  // 1. Process backlog mapped issues
  for (const [id, config] of Object.entries(BACKLOG_MAP)) {
    const orig = backlog[id];
    if (!orig) {
      console.warn(`Warning: Could not find issue #${id} in docs/ECSOC_ISSUES.md`);
      continue;
    }

    const titlePrefix = `${config.category}: `;
    const updatedTitle = titlePrefix + orig.title;
    
    // Merge labels
    const updatedLabels = Array.from(new Set([
      'ECSoC26',
      ...config.extraLabels,
      ...orig.labels
    ]));

    finalIssues.push({
      title: updatedTitle,
      body: orig.body,
      labels: updatedLabels
    });
  }

  // 2. Add custom issues
  finalIssues.push(...CUSTOM_ISSUES);

  console.log(`Prepared ${finalIssues.length} issues. Deploying to GitHub...\n`);

  for (let i = 0; i < finalIssues.length; i++) {
    await createIssue(finalIssues[i], i);
    // Delay to respect secondary rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\nAll issues successfully deployed!');
}

run();
