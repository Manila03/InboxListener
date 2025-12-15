// Content Script for Outlook Scraper

console.log('[Outlook Scraper] Content script loaded');

let processedEmails = new Set();
let listObserver = null;

const SELECTORS = {
    emailList: '[role="listbox"]',
    emailItem: '[role="option"]',
    // Heuristics for Reading Pane
    // "Message body" or specific classes are common
    readingPane: '[aria-label="Message body"], [data-app-section="ConversationContainer"], [role="document"]',
    // Fallback if we can't find a specific "body" container
    // We might look for the element that contains the subject text in `h1`?
};

function init() {
    console.log('[Outlook Scraper] Initializing...');
    const list = document.querySelector(SELECTORS.emailList);
    if (list) {
        startObservingList(list);
    } else {
        const bodyObserver = new MutationObserver((mutations, obs) => {
            const list = document.querySelector(SELECTORS.emailList);
            if (list) {
                startObservingList(list);
                obs.disconnect();
            }
        });
        bodyObserver.observe(document.body, { childList: true, subtree: true });
    }
}

function startObservingList(list) {
    list.style.border = "2px solid blue"; // Blue for Body Scraping Mode
    list.title = "Outlook Scraper (Full Body Mode)";
    attachListObserver(list);
}

function attachListObserver(listNode) {
    setTimeout(() => {
        // On load, we might not want to click everything. 
        // Only click NEW items to avoid disrupting startup?
        // For now, only new items.
    }, 1000);

    listObserver = new MutationObserver((mutations) => {
        // Collect new nodes
        const newItems = [];
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                    if (node.matches && node.matches(SELECTORS.emailItem)) {
                        newItems.push(node);
                    }
                    const children = node.querySelectorAll ? node.querySelectorAll(SELECTORS.emailItem) : [];
                    children.forEach(child => newItems.push(child));
                }
            });
        });

        if (newItems.length > 0) {
            processNewItems(newItems);
        }
    });

    listObserver.observe(listNode, { childList: true, subtree: true });
}

function isUnread(node) {
    const label = node.getAttribute('aria-label') || "";
    const lower = label.toLowerCase();
    return lower.includes('unread') || lower.includes('no leído');
}

async function processNewItems(nodes) {
    for (const node of nodes) {
        // Unique ID
        const id = node.getAttribute('data-convid') || node.getAttribute('aria-label');
        if (id && !processedEmails.has(id)) {

            // Only process unread
            if (isUnread(node)) {
                processedEmails.add(id);
                console.log(`[Outlook Scraper] New Unread Item found. ID: ${id}`);

                await clickAndScrape(node);

                // Add a small delay between items to not overwhelm
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    }
}

async function clickAndScrape(node) {
    console.log('[Outlook Scraper] Clicking email to load body...');

    // 1. Click the item
    node.click();

    // 2. Wait for the reading pane to load
    // We can pause for X seconds, or check for DOM changes.
    // Let's pause for 2 seconds (naive but simple)
    await new Promise(r => setTimeout(r, 2000));

    // 3. Find the body container
    const bodyContainer = document.querySelector(SELECTORS.readingPane);
    let fullBody = "Could not find body element";

    if (bodyContainer) {
        fullBody = bodyContainer.innerText;
        bodyContainer.style.border = "2px solid green"; // Visual debug
    } else {
        console.warn('[Outlook Scraper] Reading pane not found with selectors:', SELECTORS.readingPane);
        // Fallback: try to grab main?
        const main = document.querySelector('[role="main"]');
        if (main) fullBody = main.innerText;
    }

    // Extract basic info again just in case (or pass it from list item)
    // We can also extract Subject from the Reading Pane header!

    const subject = node.innerText.split('\n')[1] || "No Subject"; // Rough guess from earlier
    const sender = node.innerText.split('\n')[0] || "Unknown Sender";

    console.log('[Outlook Scraper] Scraped Body Length:', fullBody.length);

    chrome.runtime.sendMessage({
        type: 'NEW_MAIL',
        data: {
            sender: sender,
            subject: subject,
            body: fullBody,
            preview: fullBody.substring(0, 100) + "..."
        }
    });
}

init();
