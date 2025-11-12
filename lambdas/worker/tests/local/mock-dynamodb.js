/**
 * Mock DynamoDB Client for Local Testing
 * Simulates AWS DynamoDB using JSON files
 */

const fs = require('fs').promises;
const path = require('path');

class MockDynamoDB {
    constructor(basePath = './tests/local/output/dynamodb') {
        this.basePath = basePath;
        this.tables = new Map();
    }

    /**
     * Initialize mock DynamoDB storage
     */
    async initialize() {
        await fs.mkdir(this.basePath, { recursive: true });
        console.log(`✅ Mock DynamoDB initialized at: ${this.basePath}`);
    }

    /**
     * Get table file path
     */
    getTablePath(tableName) {
        return path.join(this.basePath, `${tableName}.json`);
    }

    /**
     * Load table data
     */
    async loadTable(tableName) {
        const filePath = this.getTablePath(tableName);
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            // Table doesn't exist yet, return empty
            return { items: [] };
        }
    }

    /**
     * Save table data
     */
    async saveTable(tableName, data) {
        const filePath = this.getTablePath(tableName);
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    }

    /**
     * Put item
     */
    put(params) {
        const { TableName, Item } = params;

        const promise = (async () => {
            const table = await this.loadTable(TableName);

            // Remove existing item with same PK/SK
            table.items = table.items.filter(item =>
                !(item.PK === Item.PK && item.SK === Item.SK)
            );

            // Add new item
            table.items.push({
                ...Item,
                _created_at: new Date().toISOString()
            });

            await this.saveTable(TableName, table);
            console.log(`✅ DynamoDB PUT: ${TableName} - ${Item.PK}/${Item.SK}`);

            return {};
        })();

        return {
            promise: () => promise
        };
    }

    /**
     * Get item
     */
    get(params) {
        const { TableName, Key } = params;

        const promise = (async () => {
            const table = await this.loadTable(TableName);

            const item = table.items.find(item =>
                item.PK === Key.PK && item.SK === Key.SK
            );

            if (item) {
                console.log(`✅ DynamoDB GET: ${TableName} - ${Key.PK}/${Key.SK}`);
            } else {
                console.log(`⚠️  DynamoDB GET (not found): ${TableName} - ${Key.PK}/${Key.SK}`);
            }

            return {
                Item: item || null,
                $response: {}
            };
        })();

        return {
            promise: () => promise
        };
    }

    /**
     * Query items
     */
    query(params) {
        const { TableName, KeyConditionExpression, ExpressionAttributeValues } = params;

        const promise = (async () => {
            const table = await this.loadTable(TableName);

            // Simple implementation - just match PK
            const pkValue = ExpressionAttributeValues[':pk'];
            const items = table.items.filter(item => item.PK === pkValue);

            console.log(`✅ DynamoDB QUERY: ${TableName} - Found ${items.length} items`);

            return {
                Items: items,
                Count: items.length,
                $response: {}
            };
        })();

        return {
            promise: () => promise
        };
    }

    /**
     * Update item
     */
    update(params) {
        const { TableName, Key, UpdateExpression, ExpressionAttributeValues, ExpressionAttributeNames } = params;

        const promise = (async () => {
            const table = await this.loadTable(TableName);

            const itemIndex = table.items.findIndex(item =>
                item.PK === Key.PK && item.SK === Key.SK
            );

            if (itemIndex === -1) {
                console.error(`❌ DynamoDB UPDATE failed: Item not found ${Key.PK}/${Key.SK}`);
                const error = new Error('ResourceNotFoundException');
                error.code = 'ResourceNotFoundException';
                throw error;
            }

        // Simple update implementation
        // Parse SET expressions
        if (UpdateExpression && UpdateExpression.includes('SET')) {
            const setExpression = UpdateExpression.split('SET')[1].trim();
            const assignments = setExpression.split(',').map(s => s.trim());

            assignments.forEach(assignment => {
                const [attr, value] = assignment.split('=').map(s => s.trim());

                // Replace attribute names
                let finalAttr = attr;
                if (ExpressionAttributeNames) {
                    Object.keys(ExpressionAttributeNames).forEach(placeholder => {
                        finalAttr = finalAttr.replace(placeholder, ExpressionAttributeNames[placeholder]);
                    });
                }

                // Replace attribute values
                let finalValue = value;
                if (ExpressionAttributeValues) {
                    Object.keys(ExpressionAttributeValues).forEach(placeholder => {
                        if (value === placeholder) {
                            finalValue = ExpressionAttributeValues[placeholder];
                        }
                    });
                }

                // Handle nested attributes (e.g., progress.completed)
                if (finalAttr.includes('.')) {
                    const parts = finalAttr.split('.');
                    let current = table.items[itemIndex];
                    for (let i = 0; i < parts.length - 1; i++) {
                        if (!current[parts[i]]) current[parts[i]] = {};
                        current = current[parts[i]];
                    }

                    // Handle increment operations
                    if (typeof finalValue === 'string' && finalValue.includes('+')) {
                        const [base, increment] = finalValue.split('+').map(s => s.trim());
                        const incrementValue = ExpressionAttributeValues[increment] || 0;
                        current[parts[parts.length - 1]] = (current[parts[parts.length - 1]] || 0) + incrementValue;
                    } else {
                        current[parts[parts.length - 1]] = finalValue;
                    }
                } else {
                    table.items[itemIndex][finalAttr] = finalValue;
                }
            });
        }

            table.items[itemIndex]._updated_at = new Date().toISOString();

            await this.saveTable(TableName, table);
            console.log(`✅ DynamoDB UPDATE: ${TableName} - ${Key.PK}/${Key.SK}`);

            return {
                Attributes: table.items[itemIndex]
            };
        })();

        return {
            promise: () => promise
        };
    }

    /**
     * Delete item
     */
    delete(params) {
        const { TableName, Key } = params;

        const promise = (async () => {
            const table = await this.loadTable(TableName);

            table.items = table.items.filter(item =>
                !(item.PK === Key.PK && item.SK === Key.SK)
            );

            await this.saveTable(TableName, table);
            console.log(`✅ DynamoDB DELETE: ${TableName} - ${Key.PK}/${Key.SK}`);

            return { $response: {} };
        })();

        return {
            promise: () => promise
        };
    }

    /**
     * Scan table (list all items)
     */
    scan(params) {
        const { TableName } = params;

        const promise = (async () => {
            const table = await this.loadTable(TableName);

            console.log(`✅ DynamoDB SCAN: ${TableName} - ${table.items.length} items`);

            return {
                Items: table.items,
                Count: table.items.length,
                $response: {}
            };
        })();

        return {
            promise: () => promise
        };
    }

    /**
     * Clear all mock data
     */
    async clear() {
        try {
            await fs.rm(this.basePath, { recursive: true, force: true });
            await fs.mkdir(this.basePath, { recursive: true });
            console.log(`✅ Mock DynamoDB cleared: ${this.basePath}`);
        } catch (error) {
            console.error('❌ Failed to clear mock DynamoDB:', error);
        }
    }

    /**
     * Export table data as JSON
     */
    async exportTable(tableName, outputPath) {
        const table = await this.loadTable(tableName);
        await fs.writeFile(outputPath, JSON.stringify(table.items, null, 2));
        console.log(`✅ Exported ${table.items.length} items to ${outputPath}`);
        return table.items;
    }
}

module.exports = MockDynamoDB;
