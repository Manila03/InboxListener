export class GoogleGenAI {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.models = new Models(this.apiKey);
    }
}

class Models {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = "https://generativelanguage.googleapis.com/v1beta";
    }

    async countTokens(params) {
        const { model, contents } = params;
        const url = `${this.baseUrl}/models/${model}:countTokens?key=${this.apiKey}`;

        // Ensure contents is formatted correctly (array of parts or string)
        const formattedContents = this._formatContents(contents);

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: formattedContents })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        return data;
    }

    async generateContent(params) {
        const { model, contents } = params;
        const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;

        const formattedContents = this._formatContents(contents);

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: formattedContents })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        // Mimic SDK response structure helper check
        if (!data.candidates || data.candidates.length === 0) {
            // Handle safety blocks or empty responses
            return { response: { text: () => "" }, candidates: [] };
        }

        // Add helper method .response.text() to the result to match SDK
        data.response = {
            text: () => data.candidates[0]?.content?.parts?.[0]?.text || ""
        };

        return data;
    }

    _formatContents(contents) {
        // If it's already an array of objects, assume it matches expected format
        if (Array.isArray(contents) && typeof contents[0] === 'object') {
            return contents;
        }
        // If it's a simple string, wrap it
        if (typeof contents === 'string') {
            return [{ parts: [{ text: contents }] }];
        }
        // If it's a single object (not array), wrap it in array
        return [contents];
    }
}
