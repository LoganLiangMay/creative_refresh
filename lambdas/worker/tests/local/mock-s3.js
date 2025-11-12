/**
 * Mock S3 Client for Local Testing
 * Simulates AWS S3 by writing files to local filesystem
 */

const fs = require('fs').promises;
const path = require('path');

class MockS3 {
    constructor(basePath = './tests/local/output/s3') {
        this.basePath = basePath;
        this.buckets = new Map();
    }

    /**
     * Initialize mock S3 storage
     */
    async initialize() {
        await fs.mkdir(this.basePath, { recursive: true });
        console.log(`✅ Mock S3 initialized at: ${this.basePath}`);
    }

    /**
     * Put object (write file)
     */
    putObject(params) {
        const { Bucket, Key, Body, ContentType, Metadata, Tagging } = params;

        const promise = (async () => {
            // Create bucket directory if it doesn't exist
            const bucketPath = path.join(this.basePath, Bucket);
            await fs.mkdir(bucketPath, { recursive: true });

            // Create full file path
            const filePath = path.join(bucketPath, Key);
            const fileDir = path.dirname(filePath);
            await fs.mkdir(fileDir, { recursive: true });

            // Write file
            await fs.writeFile(filePath, Body);

            // Write metadata
            const metadataPath = filePath + '.meta.json';
            await fs.writeFile(metadataPath, JSON.stringify({
                ContentType,
                Metadata,
                Tagging,
                Size: Body.length,
                LastModified: new Date().toISOString(),
                Key,
                Bucket
            }, null, 2));

            console.log(`✅ S3 PUT: s3://${Bucket}/${Key} → ${filePath}`);

            return {
                ETag: '"' + Date.now().toString(16) + '"',
                VersionId: 'v1'
            };
        })();

        // Return AWS SDK v2 style object with promise() method
        return {
            promise: () => promise
        };
    }

    /**
     * Get object (read file)
     */
    getObject(params) {
        const { Bucket, Key } = params;

        const promise = (async () => {
            const filePath = path.join(this.basePath, Bucket, Key);

            try {
                const body = await fs.readFile(filePath);
                const metadataPath = filePath + '.meta.json';
                let metadata = {};
                try {
                    const metaContent = await fs.readFile(metadataPath, 'utf8');
                    metadata = JSON.parse(metaContent);
                } catch (err) {
                    // Metadata file might not exist
                }

                console.log(`✅ S3 GET: s3://${Bucket}/${Key}`);

                return {
                    Body: body,
                    ContentType: metadata.ContentType || 'application/octet-stream',
                    Metadata: metadata.Metadata || {},
                    ContentLength: body.length,
                    $response: {}
                };
            } catch (error) {
                console.error(`❌ S3 GET failed: s3://${Bucket}/${Key}`, error.message);
                throw new Error(`NoSuchKey: The specified key does not exist.`);
            }
        })();

        return {
            promise: () => promise
        };
    }

    /**
     * List objects in bucket
     */
    listObjectsV2(params) {
        const { Bucket, Prefix = '' } = params;

        const promise = (async () => {
            const bucketPath = path.join(this.basePath, Bucket);

            try {
                const files = await this.walkDir(bucketPath, Prefix);
                const objects = files.map(file => ({
                    Key: path.relative(bucketPath, file).replace(/\\/g, '/'),
                    Size: 0, // Would need to stat each file
                    LastModified: new Date()
                })).filter(obj => !obj.Key.endsWith('.meta.json'));

                console.log(`✅ S3 LIST: s3://${Bucket}/${Prefix} (${objects.length} objects)`);

                return {
                    Contents: objects,
                    IsTruncated: false,
                    $response: {}
                };
            } catch (error) {
                return {
                    Contents: [],
                    IsTruncated: false,
                    $response: {}
                };
            }
        })();

        return {
            promise: () => promise
        };
    }

    /**
     * Delete object
     */
    deleteObject(params) {
        const { Bucket, Key } = params;

        const promise = (async () => {
            const filePath = path.join(this.basePath, Bucket, Key);

            try {
                await fs.unlink(filePath);
                await fs.unlink(filePath + '.meta.json').catch(() => {});
                console.log(`✅ S3 DELETE: s3://${Bucket}/${Key}`);
            } catch (error) {
                console.error(`❌ S3 DELETE failed: s3://${Bucket}/${Key}`);
            }

            return { $response: {} };
        })();

        return {
            promise: () => promise
        };
    }

    /**
     * Recursively walk directory
     */
    async walkDir(dir, prefix = '') {
        let files = [];
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    files = files.concat(await this.walkDir(fullPath, prefix));
                } else {
                    const relativePath = path.relative(dir, fullPath);
                    if (!prefix || relativePath.startsWith(prefix)) {
                        files.push(fullPath);
                    }
                }
            }
        } catch (error) {
            // Directory doesn't exist yet
        }
        return files;
    }

    /**
     * Get public URL for object (simulated)
     */
    getPublicUrl(bucket, key) {
        return `https://${bucket}.s3.amazonaws.com/${key}`;
    }

    /**
     * Clear all mock data
     */
    async clear() {
        try {
            await fs.rm(this.basePath, { recursive: true, force: true });
            await fs.mkdir(this.basePath, { recursive: true });
            console.log(`✅ Mock S3 cleared: ${this.basePath}`);
        } catch (error) {
            console.error('❌ Failed to clear mock S3:', error);
        }
    }
}

module.exports = MockS3;
