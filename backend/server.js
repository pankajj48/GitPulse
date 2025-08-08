/* server.js */
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
require('dotenv').config();

const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- Helper Functions ---

function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = hash % 360;
    return `hsl(${h}, 70%, 50%)`;
}

function buildFileTree(fullTree, filesWithContent) {
    const root = { name: 'root', type: 'folder', children: [] };
    const contentMap = new Map(filesWithContent.map(file => [file.path, file.content]));

    for (const item of fullTree) {
        const parts = item.path.split('/');
        let currentNode = root;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            
            if (!currentNode.children) {
                break;
            }

            const isLastPart = i === parts.length - 1;
            let childNode = currentNode.children.find(child => child.name === part);

            if (!childNode) {
                const currentPath = parts.slice(0, i + 1).join('/');
                const isFolder = isLastPart ? item.type === 'tree' : true;
                
                childNode = {
                    name: part,
                    path: currentPath,
                    type: isFolder ? 'folder' : 'file',
                    children: isFolder ? [] : undefined,
                };
                
                if (!isFolder) {
                    childNode.id = item.path;
                    if (contentMap.has(item.path)) {
                        childNode.content = contentMap.get(item.path);
                        childNode.isActive = true;
                    } else {
                        childNode.isActive = false;
                    }
                }
                currentNode.children.push(childNode);
            }
            currentNode = childNode;
        }
    }
    return root.children;
}

function parseGitHubUrl(url) {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    return match ? { owner: match[1], repo: match[2].replace('.git', '') } : null;
}

function resolveImportPath(currentPath, importPath, filePathsSet) {
    if (importPath.startsWith('http') || !importPath) {
        return null;
    }

    const dir = path.posix.dirname(currentPath);
    const resolved = path.posix.join(dir, importPath);

    const extensions = ['', '.js', '.jsx', '.ts', '.tsx', '.json', '/index.js', '/index.jsx', '/index.ts', '/index.tsx'];
    for (const ext of extensions) {
        if (filePathsSet.has(resolved + ext)) {
            return resolved + ext;
        }
    }
    return null;
}

// --- API Endpoints ---
app.post('/api/visualize', async (req, res) => {
    const { repoUrl } = req.body;
    const repoInfo = parseGitHubUrl(repoUrl);

    if (!repoInfo) {
        return res.status(400).json({ error: 'Invalid GitHub URL format.' });
    }

    const { owner, repo } = repoInfo;
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const headers = GITHUB_TOKEN ? { 'Authorization': `token ${GITHUB_TOKEN}` } : {};

    try {
        const repoMetaUrl = `https://api.github.com/repos/${owner}/${repo}`;
        const metaResponse = await axios.get(repoMetaUrl, { headers });
        const defaultBranch = metaResponse.data.default_branch;
        const languagesUrl = metaResponse.data.languages_url;

        let ownerInfo = null;
        let languagesData = null;

        try {
            const ownerInfoUrl = `https://api.github.com/users/${owner}`;
            const graphqlQuery = {
                query: `query($username: String!) { user(login: $username) { pinnedItems(first: 6, types: REPOSITORY) { nodes { ... on Repository { name description url stargazerCount primaryLanguage { name color } } } } } }`,
                variables: { username: owner }
            };
            const [ownerResponse, pinnedResponse, languagesResponse] = await Promise.all([
                axios.get(ownerInfoUrl, { headers }),
                axios.post('https://api.github.com/graphql', graphqlQuery, { headers }),
                axios.get(languagesUrl, { headers })
            ]);

            ownerInfo = {
                avatarUrl: ownerResponse.data.avatar_url,
                name: ownerResponse.data.name,
                bio: ownerResponse.data.bio,
                htmlUrl: ownerResponse.data.html_url,
                pinnedItems: pinnedResponse.data.data.user.pinnedItems.nodes
            };

            const totalBytes = Object.values(languagesResponse.data).reduce((a, b) => a + b, 0);
            languagesData = Object.entries(languagesResponse.data).map(([lang, bytes]) => ({
                name: lang,
                percentage: totalBytes > 0 ? ((bytes / totalBytes) * 100).toFixed(2) : 0
            })).sort((a, b) => b.percentage - a.percentage);

        } catch (infoError) {
            console.warn("Could not fetch extended owner/language info. Continuing without it.");
        }

        const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`;
        const treeResponse = await axios.get(treeUrl, { headers });
        const fullTree = treeResponse.data.tree;
        
        const relevantFiles = fullTree.filter(
            file => file.type === 'blob' && (
                file.path.endsWith('.js') || file.path.endsWith('.jsx') || 
                file.path.endsWith('.ts') || file.path.endsWith('.tsx') ||
                file.path.endsWith('.html') || file.path.endsWith('.css') ||
                file.path.endsWith('.json') || file.path.endsWith('.md')
            )
        );

        if (relevantFiles.length === 0) {
            return res.status(404).json({ error: `No relevant files found in the default branch ('${defaultBranch}').` });
        }

        const filesWithContent = await Promise.all(
            relevantFiles.map(async file => {
                const contentResponse = await axios.get(file.url, { headers });
                return { path: file.path, content: contentResponse.data.content };
            })
        );
        
        const fileTree = buildFileTree(fullTree, filesWithContent);

        const nodes = filesWithContent.map(file => ({
            id: file.path,
            name: file.path.split('/').pop(),
            size: Buffer.from(file.content, 'base64').toString('utf8').length,
            content: file.content,
            color: stringToColor(file.path)
        }));

        const links = [];
        const filePathsSet = new Set(filesWithContent.map(f => f.path));

        for (const file of filesWithContent) {
            const code = Buffer.from(file.content, 'base64').toString('utf8');
            
            if (file.path.endsWith('.html')) {
                const linkRegex = /<link.*?href=["'](.*?)["']/g;
                const scriptRegex = /<script.*?src=["'](.*?)["']/g;
                let match;
                while ((match = linkRegex.exec(code)) !== null) {
                    const targetPath = resolveImportPath(file.path, match[1], filePathsSet);
                    if (targetPath) links.push({ source: file.path, target: targetPath });
                }
                while ((match = scriptRegex.exec(code)) !== null) {
                    const targetPath = resolveImportPath(file.path, match[1], filePathsSet);
                    if (targetPath) links.push({ source: file.path, target: targetPath });
                }
            } else if (file.path.endsWith('.css')) {
                const importRegex = /@import\s+(?:url\((['"]?)(.*?)\1\)|(['"])(.*?)\3)/g;
                let match;
                while ((match = importRegex.exec(code)) !== null) {
                    const importPath = match[2] || match[4];
                    const targetPath = resolveImportPath(file.path, importPath, filePathsSet);
                    if (targetPath) links.push({ source: file.path, target: targetPath });
                }
            } else if (/\.(js|jsx|ts|tsx)$/.test(file.path)) {
                try {
                    const ast = parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator'] });
                    traverse(ast, {
                        ImportDeclaration(astPath) {
                            const source = astPath.node.source.value;
                            const targetPath = resolveImportPath(file.path, source, filePathsSet);
                            if (targetPath) {
                                links.push({ source: file.path, target: targetPath });
                            }
                        },
                    });
                } catch (e) {
                    console.warn(`Could not parse ${file.path}: ${e.message}`);
                }
            }
        }

        res.json({ ownerInfo, languages: languagesData, nodes, links, tree: fileTree });

    } catch (error) {
        console.error('Backend Error:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to fetch repository data. It might be private or does not exist.' });
    }
});

app.post('/api/summarize', async (req, res) => {
    const { code } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'AI API key is not configured on the server.' });
    if (!code) return res.status(400).json({ error: 'No code provided for summarization.' });

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const prompt = `
        You are an expert code analyst. Provide a structured summary... Use the following template exactly.
        
        Overall Purpose

            A brief, one-to-two sentence explanation...
        
        Key Components & Functionality

            Use a ordered list without(*)...
            ...and so on

        \`\`\`
        ${code}
        \`\`\`
`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const summary = response.text();
        res.json({ summary });
    } catch (error) {
        console.error('AI Summarization Error:', error);
        res.status(500).json({ error: 'Failed to get summary from AI service.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
