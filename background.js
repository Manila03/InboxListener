// Background Service Worker
// Removed GoogleGenAI import

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'NEW_MAIL') {
        handleNewMail(message.data);
    }
});

// ✅ Step 1: Text normalization
function normalizeText(text) {
    return text
        .toLowerCase()
        .normalize("NFD")                 // split accents
        .replace(/[\u0300-\u036f]/g, "")  // remove accents
        .replace(/[^a-z0-9\s]/g, " ")     // remove punctuation
        .replace(/\s+/g, " ")             // collapse spaces
        .trim();
}

// ✅ Step 2: Tokenize mail body
function tokenize(text) {
    return normalizeText(text).split(" ");
}

// ✅ Step 3: Levenshtein distance (small & fast)
function levenshtein(a, b) {
    const dp = Array.from({ length: a.length + 1 }, () =>
        new Array(b.length + 1).fill(0)
    );

    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
    }

    return dp[a.length][b.length];
}

// ✅ Step 4: Keyword matcher (exact + fuzzy)
function detectKeyword(body, keywords, maxDistance = 1) {
    const tokens = tokenize(body);
    const normalizedKeywords = keywords.map(k => normalizeText(k));

    let bestMatch = null;
    let bestScore = Infinity;

    for (const keyword of normalizedKeywords) {
        for (const token of tokens) {
            // Exact or substring match
            if (token === keyword || token.includes(keyword)) {
                return {
                    keyword,
                    matched: token,
                    confidence: 1
                };
            }

            // Fuzzy match
            const distance = levenshtein(token, keyword);
            if (distance <= maxDistance && distance < bestScore) {
                bestScore = distance;
                bestMatch = {
                    keyword,
                    matched: token,
                    confidence: 1 - distance / keyword.length
                };
            }
        }
    }

    return bestMatch;
}

async function handleNewMail(data) {
    // Check storage for Product Map (API Key no longer needed)
    const { productMap } = await chrome.storage.local.get(['productMap']);

    if (!productMap) {
        console.warn("Product Map Not Configured. Showing basic notification.");
        createNotification(data.sender, data.subject, data.preview);
        return;
    }

    const keywords = Object.keys(productMap);
    const bodyToCheck = (data.subject + " " + data.body);

    console.log("Checking keywords:", keywords);
    console.log("Against text:", bodyToCheck.substring(0, 50) + "...");

    const result = detectKeyword(bodyToCheck, keywords, 1);

    if (result) {
        console.log("Match found:", result);
        const price = productMap[result.keyword]; // This assumes the normalized keyword matches the key, might need mapping back if keys are complex
        // Actually, we normalized the keywords for matching. If keys have accents, we might miss the lookup.
        // Better strategy: Find the original key that matches the normalized keyword.
        const originalKey = Object.keys(productMap).find(k => normalizeText(k) === result.keyword);
        const displayPrice = productMap[originalKey];

        const responseMsg = `Encontré una coincidencia con "${originalKey}" ($${displayPrice}).\nConfidence: ${(result.confidence * 100).toFixed(0)}%`;

        createNotification(
            data.sender,
            "Producto Detectado",
            responseMsg
        );
    } else {
        console.log("No keyword match");
        createNotification(data.sender, data.subject, data.preview);
    }
}

function createNotification(title, message, context) {
    const notificationId = `mail-${Date.now()}`;

    // Truncate context if needed to avoid notification errors
    const safeContext = context ? (context.length > 50 ? context.substring(0, 50) + "..." : context) : "";

    chrome.notifications.create(notificationId, {
        type: 'basic',
        iconUrl: 'icon.png',
        title: title || 'New Mail',
        message: message || 'No content',
        contextMessage: safeContext,
        priority: 2
    });
}
