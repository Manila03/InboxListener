// Content Script for Outlook Scraper

console.log('[Outlook Scraper] Content script loaded');

let processedEmails = new Set();
let listObserver = null;

const SELECTORS = {
    emailList: '[role="listbox"]',
    emailItem: '[role="option"]',
    readingPane: '[id^="UniqueMessageBody"], .allowTextSelection, [data-test-id="mailMessageBodyContainer"], [role="document"]'
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
    listObserver = new MutationObserver((mutations) => {
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

function parseEmailNode(node) {
    // Outlook ARIA labels often look like: "From Sender, Subject Subject, Received Time, Status"
    // Example: "unread, wireless_modem, from Google, subject Your receipt, received Yesterday, focused"
    // Or: "De Google, Asunto Tu recibo, ..."

    let label = node.getAttribute('aria-label') || "";

    // Normalize spaces
    label = label.replace(/\s+/g, ' ').trim();

    if (!label) {
        // Fallback to text splitting if absolutely no label
        const textParts = node.innerText.split('\n');
        return {
            sender: textParts[0] || "Unknown Sender",
            subject: textParts[1] || "No Subject (Fallback)",
            isUnread: false // Can't reliably tell without label
        };
    }

    const lowerLabel = label.toLowerCase();
    const isUnread = lowerLabel.includes('unread') || lowerLabel.includes('no leído');

    // Regex extraction strategies
    // 1. Try "From X, Subject Y" structure (English)
    let senderMatch = label.match(/from\s+([^,]+)/i);
    let subjectMatch = label.match(/subject\s+([^,]+)/i);

    // 2. Try "De X, Asunto Y" structure (Spanish)
    if (!senderMatch) senderMatch = label.match(/de\s+([^,]+)/i);
    if (!subjectMatch) subjectMatch = label.match(/asunto\s+([^,]+)/i);

    let sender = senderMatch ? senderMatch[1].trim() : null;
    let subject = subjectMatch ? subjectMatch[1].trim() : null;

    // Fallback if regex fails but we have a label (sometimes layout differs)
    // We can try to assume part 0 is status, part 1 is sender? No, too risky.
    // Let's rely on the innerText fallback for content if regex misses, 
    // BUT we trust 'isUnread' from the label.
    if (!sender || !subject) {
        const textParts = node.innerText.split('\n');
        if (!sender) sender = textParts[0] || "Unknown Sender";
        if (!subject) subject = textParts[1] || "No Subject";
    }

    return { sender, subject, isUnread };
}

async function processNewItems(nodes) {
    for (const node of nodes) {
        // Unique ID
        const id = node.getAttribute('data-convid') || node.getAttribute('aria-label');
        if (!id || processedEmails.has(id)) continue;

        const metadata = parseEmailNode(node);

        if (metadata.isUnread) {
            processedEmails.add(id);
            console.log(`[Outlook Scraper] New Unread Item: ${metadata.sender} - ${metadata.subject}`);

            // Pass metadata to click function to avoid re-scraping it poorly
            await clickAndScrape(node, metadata);

            await new Promise(r => setTimeout(r, 1000));
        }
    }
}

async function clickAndScrape(node, metadata) {
    console.log('[Outlook Scraper] Clicking email to load body...');

    node.click();
    await new Promise(r => setTimeout(r, 2000)); // Wait for content to load

    // 3. Find the body container
    const bodyContainer = document.querySelector(SELECTORS.readingPane);
    let fullBody = "";

    if (bodyContainer) {
        console.log(`[Outlook Scraper] Found body container: ${bodyContainer.id || bodyContainer.className}`);
        bodyContainer.style.border = "2px solid green";

        // Strategy A: Direct innerText
        fullBody = bodyContainer.innerText;

        // Strategy B: Deep dive for the actual message text div if the top level is empty or cluttered
        // The user snippet shows the text is often in a div with dir="auto" or specific classes inside the container
        if (!fullBody || fullBody.length < 5) {
            const deepTextNode = bodyContainer.querySelector('div[dir="auto"], .x_gmail_quote, .rps_a050');
            if (deepTextNode) {
                fullBody = deepTextNode.innerText || deepTextNode.textContent;
            } else {
                // Fallback to textContent if innerText was empty due to visibility
                fullBody = bodyContainer.textContent;
            }
        }
    } else {
        console.warn('[Outlook Scraper] Reading pane not found.');
        fullBody = "Could not find body element";
    }

    fullBody = fullBody.trim();
    console.log('[Outlook Scraper] Final Scraped Body Length:', fullBody.length);
    console.log('[Outlook Scraper] Body Preview:', fullBody.substring(0, 50));

    chrome.runtime.sendMessage({
        type: 'NEW_MAIL',
        data: {
            sender: metadata.sender,
            subject: metadata.subject,
            body: fullBody,
            preview: fullBody.substring(0, 100) + "..."
        }
    });
}

init();
