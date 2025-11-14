document.addEventListener('DOMContentLoaded', () => {
    const tabsContainer = document.getElementById('tabs-container');
    const panelsContainer = document.getElementById('tab-panels-container');
    let collapsedStates = {};

    function updateAndSaveState(id, isCollapsed) {
        collapsedStates[id] = isCollapsed;
        chrome.storage.local.set({ collapsedStates });
    }

    function createCard(bookmark) {
        const card = document.createElement('a');
        card.className = 'card';
        card.href = bookmark.url;
        card.target = '_blank';

        const icon = document.createElement('img');
        icon.className = 'card-icon';
        // Use the extension's favicon service which can access internal sites
        icon.src = `/_favicon/?pageUrl=${encodeURIComponent(bookmark.url)}&size=32`;
        icon.alt = ''; // Decorative image

        const title = document.createElement('div');
        title.className = 'card-title';
        title.textContent = bookmark.title || getDomain(bookmark.url);
        
        card.appendChild(icon);
        card.appendChild(title);

        return card;
    }

    function getDomain(url) {
        try {
            return new URL(url).hostname;
        } catch (e) {
            return url;
        }
    }

    function processNode(node, parentElement) {
        // It's a folder
        if (node.children) {
            let containerForChildren;
            // These are the borderless blocks like "life" and "work"
            if (node.title) {
                const blockContainer = document.createElement('div');
                if (collapsedStates[node.id]) {
                    blockContainer.classList.add('collapsed');
                }
                
                const folderTitle = document.createElement('h2');
                folderTitle.className = 'folder-title';
                folderTitle.textContent = node.title;
                blockContainer.appendChild(folderTitle);

                folderTitle.addEventListener('click', () => {
                    const isCollapsing = !blockContainer.classList.contains('collapsed');
                    blockContainer.classList.toggle('collapsed');
                    updateAndSaveState(node.id, isCollapsing);
                });

                containerForChildren = document.createElement('div');
                containerForChildren.className = 'top-level-folder-content';
                blockContainer.appendChild(containerForChildren);

                parentElement.appendChild(blockContainer);
            } else {
                 // This case handles the root of a tab panel
                containerForChildren = parentElement;
            }
            node.children.forEach(child => processSubNode(child, containerForChildren));
        }
        // It's a bookmark - this is now handled in buildUI
    }

    function processSubNode(node, parentElement) {
        // It's a nested folder (e.g., "universe") -> create a dashed group
        if (node.children) {
            const folderGroup = document.createElement('div');
            folderGroup.className = 'folder-group';
            if (collapsedStates[node.id]) {
                folderGroup.classList.add('collapsed');
            }

            const folderTitle = document.createElement('h2');
            folderTitle.className = 'folder-title';
            folderTitle.textContent = node.title;
            folderGroup.appendChild(folderTitle);

            folderTitle.addEventListener('click', () => {
                const isCollapsing = !folderGroup.classList.contains('collapsed');
                folderGroup.classList.toggle('collapsed');
                updateAndSaveState(node.id, isCollapsing);
            });

            const itemsContainer = document.createElement('div');
            itemsContainer.className = 'folder-items';
            folderGroup.appendChild(itemsContainer);
            
            parentElement.appendChild(folderGroup);
            
            node.children.forEach(child => processSubNode(child, itemsContainer));
        }

        // It's a bookmark
        if (node.url) {
            parentElement.appendChild(createCard(node));
        }
    }

    function buildUI() {
        chrome.bookmarks.getTree((bookmarkTree) => {
            const topLevelFolders = bookmarkTree[0].children;

            topLevelFolders.forEach((folder, index) => {
                if (!folder.children) return; // Skip if it's not a folder

                // Create Tab
                const tab = document.createElement('button');
                tab.className = 'tab-button';
                tab.textContent = folder.title;
                tab.dataset.tabId = folder.id;
                tabsContainer.appendChild(tab);

                // Create Panel
                const panel = document.createElement('div');
                panel.className = 'tab-panel';
                panel.id = `panel-${folder.id}`;
                panelsContainer.appendChild(panel);

                // Separate direct bookmarks from sub-folders
                const directBookmarks = folder.children.filter(node => node.url);
                const subFolders = folder.children.filter(node => node.children);

                // Populate panel with folder blocks first
                subFolders.forEach(node => processNode(node, panel));

                // Create an untitled block for direct bookmarks if they exist, and add it to the bottom
                if (directBookmarks.length > 0) {
                    const blockContainer = document.createElement('div'); // No title
                    const containerForChildren = document.createElement('div');
                    containerForChildren.className = 'top-level-folder-content';
                    directBookmarks.forEach(bookmark => {
                        containerForChildren.appendChild(createCard(bookmark));
                    });
                    blockContainer.appendChild(containerForChildren);
                    panel.appendChild(blockContainer);
                }

                // Set first tab as active
                if (index === 0) {
                    tab.classList.add('active');
                    panel.classList.add('active');
                }
            });

            // Add click event to tabs
            tabsContainer.addEventListener('click', (e) => {
                if (e.target.matches('.tab-button')) {
                    const tabId = e.target.dataset.tabId;

                    // Deactivate all
                    tabsContainer.querySelectorAll('.tab-button').forEach(t => t.classList.remove('active'));
                    panelsContainer.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

                    // Activate clicked
                    e.target.classList.add('active');
                    document.getElementById(`panel-${tabId}`).classList.add('active');
                }
            });
        });
    }

    // Load saved states first, then build the UI
    chrome.storage.local.get('collapsedStates', (result) => {
        if (result.collapsedStates) {
            collapsedStates = result.collapsedStates;
        }
        buildUI();
    });
});
