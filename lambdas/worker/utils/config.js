/**
 * Configuration Helper
 * Handles configuration for both local development and AWS Lambda
 *
 * Local: Loads from .env.local using dotenv
 * Lambda: Uses AWS Secrets Manager
 */

const AWS = require('aws-sdk');

// Try to load dotenv for local development (will fail silently in Lambda)
try {
    require('dotenv').config({ path: '../../.env.local' });
} catch (error) {
    // In Lambda, dotenv is not needed
}

const secretsManager = new AWS.SecretsManager();

// Determine if running locally or in Lambda
const IS_LOCAL = process.env.IS_LOCAL_DEV === 'true' || process.env.AWS_EXECUTION_ENV === undefined;

// Cache for secrets
const secretCache = {};

/**
 * Get configuration value with fallback
 * Checks environment variables first, then defaults
 */
function getConfig(key, defaultValue = null) {
    return process.env[key] || defaultValue;
}

/**
 * Get Replicate API token
 * Local: from REPLICATE_API_TOKEN env var
 * Lambda: from AWS Secrets Manager
 */
async function getReplicateToken() {
    if (IS_LOCAL) {
        const token = getConfig('REPLICATE_API_TOKEN');
        if (!token) {
            throw new Error('REPLICATE_API_TOKEN not set in .env.local');
        }
        return token;
    }

    // Lambda: fetch from Secrets Manager
    return getSecretValue(
        getConfig('REPLICATE_SECRET_NAME', `rda-generator/replicate-token-${getConfig('ENVIRONMENT', 'dev')}`),
        'token'
    );
}

/**
 * Get OpenAI API key
 * Local: from OPENAI_API_KEY env var
 * Lambda: from AWS Secrets Manager
 */
async function getOpenAIKey() {
    if (IS_LOCAL) {
        const key = getConfig('OPENAI_API_KEY');
        if (!key) {
            console.warn('OPENAI_API_KEY not set in .env.local - prompt enhancement disabled');
            return null;
        }
        return key;
    }

    // Lambda: fetch from Secrets Manager
    try {
        return await getSecretValue(
            getConfig('OPENAI_SECRET_NAME', `rda-generator/openai-api-key-${getConfig('ENVIRONMENT', 'dev')}`),
            'api_key'
        );
    } catch (error) {
        console.warn('OpenAI key not found in Secrets Manager - prompt enhancement disabled');
        return null;
    }
}

/**
 * Get secret from AWS Secrets Manager with caching
 */
async function getSecretValue(secretName, fieldName) {
    // Check cache
    const cacheKey = `${secretName}:${fieldName}`;
    if (secretCache[cacheKey]) {
        return secretCache[cacheKey];
    }

    try {
        console.log(`Retrieving secret: ${secretName}`);

        const secretResult = await secretsManager.getSecretValue({
            SecretId: secretName
        }).promise();

        // Parse secret (could be JSON or plain string)
        let secretValue;
        try {
            const secretData = JSON.parse(secretResult.SecretString);
            secretValue = secretData[fieldName];
        } catch (parseError) {
            // If not JSON, treat as plain string
            secretValue = secretResult.SecretString;
        }

        if (!secretValue) {
            throw new Error(`Secret field '${fieldName}' not found in ${secretName}`);
        }

        // Cache the secret
        secretCache[cacheKey] = secretValue;
        console.log(`Secret retrieved successfully: ${secretName}`);

        return secretValue;

    } catch (error) {
        console.error(`Failed to retrieve secret ${secretName}:`, error);
        throw new Error(`Secret retrieval failed: ${error.message}`);
    }
}

/**
 * Get all configuration for the application
 */
function getAppConfig() {
    return {
        // Environment
        environment: getConfig('ENVIRONMENT', 'dev'),
        isLocal: IS_LOCAL,
        mockMode: getConfig('MOCK_MODE', 'true') === 'true',

        // AWS Resources
        dynamodbTable: getConfig('DYNAMODB_TABLE', 'RDAImageJobs-dev'),
        s3Bucket: getConfig('S3_BUCKET', 'rda-generated-images-dev'),
        sqsQueueUrl: getConfig('SQS_QUEUE_URL'),

        // Feature Flags
        enablePromptEnhancement: getConfig('ENABLE_PROMPT_ENHANCEMENT', 'true') === 'true',

        // OpenAI Settings
        openaiModel: getConfig('OPENAI_MODEL', 'gpt-4o-mini'),

        // Logging
        logLevel: getConfig('LOG_LEVEL', 'info'),
    };
}

/**
 * Validate required configuration
 */
async function validateConfig() {
    const config = getAppConfig();
    const errors = [];

    // Check required AWS resources
    if (!config.dynamodbTable) {
        errors.push('DYNAMODB_TABLE not configured');
    }
    if (!config.s3Bucket) {
        errors.push('S3_BUCKET not configured');
    }

    // Check API keys (only in real mode)
    if (!config.mockMode) {
        try {
            await getReplicateToken();
        } catch (error) {
            errors.push(`Replicate token not available: ${error.message}`);
        }
    }

    if (errors.length > 0) {
        throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }

    return config;
}

module.exports = {
    IS_LOCAL,
    getConfig,
    getReplicateToken,
    getOpenAIKey,
    getAppConfig,
    validateConfig,
};
