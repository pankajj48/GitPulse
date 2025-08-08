import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import axios from 'axios';
import ForceGraph2D from 'react-force-graph-2d';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import Navbar from './navbar';
import Footer from './footer';

// --- Helper Functions ---
const getLanguage = (path) => {
    const extension = path.split('.').pop();
    switch (extension) {
        case 'js': return 'javascript';
        case 'jsx': return 'jsx';
        case 'ts': return 'typescript';
        case 'tsx': return 'tsx';
        case 'css': return 'css';
        case 'html': return 'html';
        case 'json': return 'json';
        case 'md': return 'markdown';
        default: return 'javascript';
    }
};

const stringToColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = hash % 360;
    return `hsl(${h}, 70%, 50%)`;
};


// --- Components ---
const CodeViewer = ({ code, path }) => {
    if (!code) return null;
    const language = getLanguage(path);
    return (
        <div className="code-viewer-container">
            <SyntaxHighlighter language={language} style={atomDark} showLineNumbers>
                {code}
            </SyntaxHighlighter>
        </div>
    );
};

const OwnerInfo = ({ info }) => {
    if (!info) return null;
    return (
        <div className="gh-panel">
            <div className="owner-header">
                <img src={info.avatarUrl} alt={info.name} className="owner-avatar" />
                <div className="owner-details">
                    <h2 className="owner-name">{info.name}</h2>
                    <p className="owner-bio">{info.bio}</p>
                    <a href={info.htmlUrl} target="_blank" rel="noopener noreferrer" className="owner-link">
                        View Profile on GitHub
                    </a>
                </div>
            </div>
            {info.pinnedItems && info.pinnedItems.length > 0 && (
                <div className="pinned-repos">
                    <h3 className="pinned-repos-title">Pinned Repositories</h3>
                    <div className="pinned-repos-grid">
                        {info.pinnedItems.map(repo => (
                            <a href={repo.url} key={repo.name} target="_blank" rel="noopener noreferrer" className="pinned-repo-item">
                                <h4 className="pinned-repo-name">{repo.name}</h4>
                                <p className="pinned-repo-desc">{repo.description}</p>
                                <div className="pinned-repo-footer">
                                    {repo.primaryLanguage && (
                                        <span className="language-indicator">
                                            <span className="language-color-dot" style={{ backgroundColor: repo.primaryLanguage.color }}></span>
                                            {repo.primaryLanguage.name}
                                        </span>
                                    )}
                                    <span>⭐ {repo.stargazerCount}</span>
                                </div>
                            </a>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const FolderTree = ({ items, onFileClick }) => {
    const renderTree = (nodes, prefix = '') =>
        nodes.map((node, index) => {
            const isLast = index === nodes.length - 1;
            const currentPrefix = prefix + (isLast ? '└── ' : '├── ');
            const childPrefix = prefix + (isLast ? '    ' : '│   ');
            const isFolder = node.type === 'folder';
            
            let lineClass = '';
            if (!isFolder) {
                lineClass = node.isActive ? 'tree-file-clickable' : 'tree-file-non-clickable';
            }

            return (
                <div key={node.path + index}>
                    <div
                        className={`tree-item-line ${lineClass}`}
                        onClick={() => !isFolder && node.isActive && onFileClick(node)}
                    >
                        {currentPrefix}
                        {isFolder ? '📁' : '📄'} {node.name}
                    </div>
                    {isFolder && node.children && renderTree(node.children, childPrefix)}
                </div>
            );
        });

    return <pre className="folder-tree">{renderTree(items)}</pre>;
};

const LanguageBreakdown = ({ languages }) => {
    if (!languages || languages.length === 0) return null;

    return (
        <div className="gh-panel">
            <h3 className="language-breakdown-title">Languages Used</h3>
            <div className="language-list">
                {languages.map(lang => (
                    <div key={lang.name} className="language-item">
                        <div className="language-info">
                            <span className="language-name">{lang.name}</span>
                            <span className="language-percentage">{lang.percentage}%</span>
                        </div>
                        <div className="language-bar-container">
                            <div
                                className="language-bar"
                                style={{
                                    width: `${lang.percentage}%`,
                                    backgroundColor: stringToColor(lang.name)
                                }}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


// --- Main Home Component ---
function Home() {
    const [repoUrl, setRepoUrl] = useState('');
    const [ownerInfo, setOwnerInfo] = useState(null);
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    const [folderTree, setFolderTree] = useState([]);
    const [languages, setLanguages] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedNode, setSelectedNode] = useState(null);
    const [summary, setSummary] = useState('');
    const [isSummaryLoading, setIsSummaryLoading] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [code, setCode] = useState('');
    const [modalView, setModalView] = useState('summary');

    const graphRef = useRef();
    const graphContainerRef = useRef(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const handleResize = () => {
            if (graphContainerRef.current) {
                const { width, height } = graphContainerRef.current.getBoundingClientRect();
                
                setDimensions(prevDimensions => {
                    if (prevDimensions.width !== width || prevDimensions.height !== height) {
                        return { width, height };
                    }
                    return prevDimensions;
                });
            }
        };

        handleResize();
        const resizeObserver = new ResizeObserver(handleResize);
        if (graphContainerRef.current) {
            resizeObserver.observe(graphContainerRef.current);
        }

        const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        return () => {
            if (graphContainerRef.current) {
                resizeObserver.unobserve(graphContainerRef.current);
            }
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, [ownerInfo]);

    useEffect(() => {
        if (graphRef.current && graphData.nodes.length > 0) {
            const fg = graphRef.current;
            fg.d3Force('charge').strength(-150);
            fg.d3Force('link').distance(80);
            fg.d3ReheatSimulation();

            setTimeout(() => {
                if (graphRef.current) graphRef.current.zoomToFit(400);
            }, 100);
        }
    }, [graphData]);

    const filteredGraphData = useMemo(() => {
        if (!searchTerm) return graphData;
        const lowerCaseSearch = searchTerm.toLowerCase();
        const filteredNodes = graphData.nodes.filter(node =>
            node.id.toLowerCase().includes(lowerCaseSearch)
        );
        const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
        const filteredLinks = graphData.links.filter(link =>
            filteredNodeIds.has(link.source.id || link.source) && filteredNodeIds.has(link.target.id || link.target)
        );
        return { nodes: filteredNodes, links: filteredLinks };
    }, [searchTerm, graphData]);

    const filteredTree = useMemo(() => {
        if (!searchTerm) return folderTree;
        const lowerCaseSearch = searchTerm.toLowerCase();
        function filter(nodes) {
            const result = [];
            for (const node of nodes) {
                if (node.type === 'folder') {
                    const children = filter(node.children);
                    if (children.length > 0) {
                        result.push({ ...node, children });
                    }
                } else if (node.name.toLowerCase().includes(lowerCaseSearch)) {
                    result.push(node);
                }
            }
            return result;
        }
        return filter(folderTree);
    }, [searchTerm, folderTree]);

    const handleVisualize = async () => {
        if (!repoUrl) {
            setError('Please enter a GitHub repository URL.');
            return;
        }
        setIsLoading(true);
        setError('');
        setGraphData({ nodes: [], links: [] });
        setFolderTree([]);
        setOwnerInfo(null);
        setLanguages(null);
        setSearchTerm('');
        try {
            const response = await axios.post('/api/visualize', { repoUrl });
            const { ownerInfo, languages, nodes, links, tree } = response.data;
            if (ownerInfo && nodes && links && tree) {
                setOwnerInfo(ownerInfo);
                setLanguages(languages);
                setGraphData({ nodes, links });
                setFolderTree(tree);
            } else {
                throw new Error('Received an invalid response from the server.');
            }
        } catch (err) {
            console.error('Visualization Error:', err);
            const errorMessage = err.response?.data?.error || 'Failed to visualize repository.';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleNodeClick = useCallback((node) => {
        if (!node || !node.content) return;

        setSelectedNode(node);
        setSummary('');
        try {
            setCode(atob(node.content));
        } catch (e) {
            console.error("Failed to decode base64 content:", e);
            setCode("Error: Could not decode file content.");
        }
        setModalView('summary');

        if (graphRef.current) {
            const fgNode = filteredGraphData.nodes.find(n => n.id === node.id);
            if(fgNode && typeof fgNode.x === 'number' && typeof fgNode.y === 'number') {
                graphRef.current.centerAt(fgNode.x, fgNode.y, 1000);
                graphRef.current.zoom(2.5, 500);
            }
        }
    }, [filteredGraphData]);

    const handleSummarize = async () => {
        if (!code) return;
        setIsSummaryLoading(true);
        setSummary('');
        try {
            const response = await axios.post('/api/summarize', { code });
            setSummary(response.data.summary);
        } catch (err) {
            const errorMessage = err.response?.data?.error || 'Failed to get summary.';
            setSummary(errorMessage);
        } finally {
            setIsSummaryLoading(false);
        }
    };

    const closeModal = () => setSelectedNode(null);

    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            graphContainerRef.current?.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    };

    const handleResetView = () => {
        if (graphRef.current) {
            graphRef.current.d3ReheatSimulation();
            graphRef.current.zoomToFit(400);
        }
    };

    const renderNode = (node, ctx, globalScale) => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI, false);
        ctx.fillStyle = node.color || 'grey';
        ctx.fill();
        const label = node.name;
        const fontSize = 12 / globalScale;
        ctx.font = `${fontSize}px Sans-Serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'white';
        ctx.fillText(label, node.x, node.y + 12);
    };

    return (
        <div className="container">
            <Navbar />
            <div className="content-wrapper">
                <header className="header">

                    <div className="homelogo">
                        <img src="./src/assets/homelogo.png" alt="logo" width={120} height={120}/>
                        <h1 className="title">GitPulse</h1>
                    </div>
                    
                    <p className="subtitle">Paste a public GitHub repository link to visualize its file structure and get AI-powered code summaries.</p>
                </header>

                <div className="gh-panel input-section">
                    <div className="input-group">
                        <input type="text" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="e.g., https://github.com/facebook/react" className="repo-input" />
                        <button onClick={handleVisualize} disabled={isLoading} className="visualize-button">
                            {isLoading ? 'Analyzing...' : 'Visualize'}
                        </button>
                    </div>
                    {error && <p className="error-message">{error}</p>}
                </div>

                {!ownerInfo && !isLoading && (
                    <div className="features-section">
                        <div className="feature-card">
                            <div className="feature-icon">🌐</div>
                            <h3 className="feature-title">Visualize Structure</h3>
                            <p className="feature-description">See any public repository as an interactive force-directed graph. Understand file relationships at a glance.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">🔗</div>
                            <h3 className="feature-title">Analyze Connections</h3>
                            <p className="feature-description">The graph intelligently maps dependencies, showing you how files import and rely on each other across the codebase.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">🤖</div>
                            <h3 className="feature-title">AI-Powered Summaries</h3>
                            <p className="feature-description">Click any file node in the graph to get a concise, AI-generated summary of its purpose and functionality.</p>
                        </div>
                    </div>
                )}

                {isLoading && <div className="loading-overlay main-loader">
                    
                    <div class="loading">
                        <svg height="48px" width="64px">
                            <polyline id="back" points="0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24"></polyline>
                            <polyline id="front" points="0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24"></polyline>
                        </svg>
                    </div>
                    
                    </div>}
                
                {ownerInfo && (
                    <div className="results-grid">
                        <div className="main-content">
                            <OwnerInfo info={ownerInfo} />
                            <LanguageBreakdown languages={languages} />
                            <div className="gh-panel graph-container" ref={graphContainerRef} style={{minHeight: '60vh'}}>
                                {graphData.nodes.length > 0 && dimensions.width > 0 && dimensions.height > 0 && (
                                    <>
                                        <ForceGraph2D
                                            ref={graphRef}
                                            width={dimensions.width}
                                            height={dimensions.height}
                                            graphData={filteredGraphData}
                                            nodeCanvasObject={renderNode}
                                            linkColor={() => 'rgba(255,255,255,0.3)'}
                                            linkDirectionalArrowLength={3.5}
                                            linkDirectionalArrowRelPos={1}
                                            onNodeClick={handleNodeClick}
                                        />
                                        <div className="graph-controls">
                                            <button onClick={handleResetView} className="control-button">Reset View</button>
                                            <button onClick={toggleFullScreen} className="control-button">
                                                {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="sidebar-content">
                            <div className="gh-panel">
                                <input
                                    type="text"
                                    className="search-input"
                                    placeholder="🔍 Search for a file..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="gh-panel folder-tree-container">
                                <h2 className="folder-tree-title">Folder Structure</h2>
                                <FolderTree items={filteredTree} onFileClick={handleNodeClick} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <Footer />
            {selectedNode && (
                 <div className="modal-bg">
                    <div className="gh-panel modal-content">
                        <header className="modal-header">
                            <h2 className="modal-title">{selectedNode.id}</h2>
                            <button onClick={closeModal} className="modal-close-button">&times;</button>
                        </header>
                        <div className="modal-body">
                            <div className="modal-view-toggle">
                                <button onClick={() => setModalView('summary')} className={modalView === 'summary' ? 'active' : ''}>AI Summary</button>
                                <button onClick={() => setModalView('code')} className={modalView === 'code' ? 'active' : ''}>View Code</button>
                            </div>
                            {modalView === 'summary' ? (
                                <>
                                    <button onClick={handleSummarize} disabled={isSummaryLoading || !code} className="summarize-button">
                                        {isSummaryLoading ? 'AI is thinking...' : 'Summarize with AI'}
                                    </button>
                                    {summary && (
                                        <div className="summary-box">
                                            <h3 className="summary-title">AI Summary:</h3>
                                            <p className="summary-text">{summary}</p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <CodeViewer code={code} path={selectedNode.id} />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Home;