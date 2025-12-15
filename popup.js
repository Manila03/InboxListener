document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey');
    const fileInput = document.getElementById('excelFile');
    const saveBtn = document.getElementById('saveBtn');
    const statusDiv = document.getElementById('status');

    // Load existing config
    chrome.storage.local.get(['geminiApiKey', 'productMap'], (result) => {
        if (result.geminiApiKey) {
            apiKeyInput.value = result.geminiApiKey;
        }
        if (result.productMap) {
            const count = Object.keys(result.productMap).length;
            statusDiv.textContent = `Loaded ${count} products.`;
        }
    });

    saveBtn.addEventListener('click', async () => {
        statusDiv.textContent = 'Processing...';
        try {
            const apiKey = apiKeyInput.value.trim();
            let productMap = {};

            if (fileInput.files.length > 0) {
                productMap = await parseExcel(fileInput.files[0]);
            } else {
                // Keep existing map if no new file
                const existing = await chrome.storage.local.get('productMap');
                productMap = existing.productMap || {};
            }

            await chrome.storage.local.set({
                geminiApiKey: apiKey,
                productMap: productMap
            });

            statusDiv.textContent = `Saved! ${Object.keys(productMap).length} products loaded.`;
            statusDiv.className = '';
        } catch (err) {
            console.error(err);
            statusDiv.textContent = 'Error: ' + err.message;
            statusDiv.className = 'error';
        }
    });
});

function parseExcel(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // strict format: Row 1 = Names, Row 2 = Prices
                // We can use sheet_to_json with header:1 to get array of arrays
                const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (rows.length < 2) {
                    throw new Error("Excel must have at least 2 rows (1: Names, 2: Prices)");
                }

                const names = rows[0]; // Row 1 keys
                const prices = rows[1]; // Row 2 values

                const map = {};

                names.forEach((name, index) => {
                    if (name && prices[index] !== undefined) {
                        // Normalized key for easier debugging? No, keep original for display.
                        // But valid JSON keys.
                        const key = String(name).trim();
                        map[key] = prices[index];
                    }
                });

                resolve(map);

            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
}
