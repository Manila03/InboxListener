// Background Service Worker
import { GoogleGenAI } from './libs/google-gen-ai.js';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'NEW_MAIL') {
        handleNewMail(message.data);
    }
});

async function handleNewMail(data) {
    // Check storage for API Key and Products
    const { geminiApiKey, productMap } = await chrome.storage.local.get(['geminiApiKey', 'productMap']);

    // If not configured, just show basic notification
    if (!geminiApiKey || !productMap) {
        console.warn("Gemini Not Configured. Showing basic notification.");
        createNotification(data.sender, data.subject, data.preview);
        return;
    }

    const productList = Object.entries(productMap).map(([name, price]) => `- ${name}: $${price}`).join('\n');

    const prompt = `
  You are a helpful sales assistant.
  Analyze the following email to see if the user is asking about any of our products.
  
  Our Products:
  ${productList}
  
  Email Subject: ${data.sender || "Unknown"}
  Email Body: 
  ${data.subject || ""}
  ${data.body || ""}
  
  Instructions:
  1. Detect if the email mentions any of our products (use semantic matching, handle synonyms).
  2. If products are found, generate a polite, professional response in Spanish properly quoting the prices from our list.
  3. If NO products are found, output "NO_MATCH".
  4. Keep the response concise.
  `;
    console.log("Prompt:", prompt);
    try {
        const ai = new GoogleGenAI({ apiKey: geminiApiKey });

        // Optional: Count tokens for logging/debugging
        // const countTokensResponse = await ai.models.countTokens({
        //   model: "gemini-2.0-flash",
        //   contents: prompt,
        // });
        // console.log("Token count:", countTokensResponse.totalTokens);

        const result = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: prompt,
        });

        const aiResponse = result.response.text();

        if (aiResponse.includes("NO_MATCH")) {
            console.log("No partial match found by AI.");
            createNotification(data.sender, data.subject, data.preview);
        } else {
            console.log("AI Response:", aiResponse);
            // Show the AI suggestion!
            createNotification(
                data.sender,
                "Respuesta Sugerida (AI)",
                aiResponse
            );
        }
    } catch (e) {
        console.error("Gemini Error:", e);
        // Fallback to basic notification if AI fails
        createNotification(data.sender, data.subject, data.preview);
        createNotification("Gemini Error", e.message, "Check API Key");
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
