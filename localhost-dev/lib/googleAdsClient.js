/**
 * Google Ads API Client
 * Handles uploading image assets and creating Responsive Display Ads
 */

const { GoogleAdsApi, resources, enums } = require('google-ads-api');
const axios = require('axios');

// Initialize Google Ads API client
function getGoogleAdsClient() {
  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  });

  const customer = client.Customer({
    customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
  });

  return { client, customer };
}

/**
 * Upload an image from URL to Google Ads as an Asset
 * @param {Object} customer - Google Ads customer instance
 * @param {string} imageUrl - Public S3 URL of the image
 * @param {string} assetName - Name for the asset
 * @param {string} assetType - 'MARKETING_IMAGE' or 'SQUARE_MARKETING_IMAGE'
 * @returns {Promise<string>} - Asset resource name
 */
async function uploadImageAsset(customer, imageUrl, assetName, assetType = 'MARKETING_IMAGE') {
  try {
    console.log(`Uploading ${assetType} asset: ${assetName}`);

    // Download image data from S3
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageData = Buffer.from(response.data).toString('base64');

    // Create Asset
    const asset = new resources.Asset({
      name: assetName,
      type: enums.AssetType.IMAGE,
      image_asset: {
        data: imageData,
      },
    });

    // Upload asset
    const result = await customer.assets.create([asset]);
    const assetResourceName = result.results[0].resource_name;

    console.log(`✅ Uploaded ${assetType} asset: ${assetResourceName}`);
    return assetResourceName;
  } catch (error) {
    console.error(`❌ Failed to upload ${assetType} asset:`, error.message);
    throw new Error(`Failed to upload image asset: ${error.message}`);
  }
}

/**
 * Create a Responsive Display Ad
 * @param {Object} adData - Ad data including images, text, and settings
 * @param {Array<string>} adData.landscapeImageUrls - S3 URLs for landscape images
 * @param {Array<string>} adData.squareImageUrls - S3 URLs for square images
 * @param {Array<string>} adData.headlines - Headlines (max 5, ≤30 chars each)
 * @param {string} adData.longHeadline - Long headline (≤90 chars)
 * @param {Array<string>} adData.descriptions - Descriptions (max 5, ≤90 chars each)
 * @param {string} adData.businessName - Business name (≤25 chars)
 * @param {string} adData.finalUrl - Final URL for the ad
 * @param {Object} options - Optional settings
 * @returns {Promise<Object>} - Created ad response
 */
async function createResponsiveDisplayAd(adData, options = {}) {
  const { customer } = getGoogleAdsClient();

  try {
    console.log('🚀 Starting Responsive Display Ad creation...');

    // Validate required fields
    if (!adData.landscapeImageUrls || adData.landscapeImageUrls.length === 0) {
      throw new Error('At least one landscape image is required');
    }
    if (!adData.squareImageUrls || adData.squareImageUrls.length === 0) {
      throw new Error('At least one square image is required');
    }
    if (!adData.headlines || adData.headlines.length === 0) {
      throw new Error('At least one headline is required');
    }
    if (!adData.longHeadline) {
      throw new Error('Long headline is required');
    }
    if (!adData.descriptions || adData.descriptions.length === 0) {
      throw new Error('At least one description is required');
    }
    if (!adData.businessName) {
      throw new Error('Business name is required');
    }

    // Validate field lengths
    if (adData.businessName.length > 25) {
      throw new Error('Business name must be ≤25 characters');
    }
    if (adData.longHeadline.length > 90) {
      throw new Error('Long headline must be ≤90 characters');
    }
    adData.headlines.forEach((h, i) => {
      if (h.length > 30) {
        throw new Error(`Headline ${i + 1} must be ≤30 characters`);
      }
    });
    adData.descriptions.forEach((d, i) => {
      if (d.length > 90) {
        throw new Error(`Description ${i + 1} must be ≤90 characters`);
      }
    });

    // Step 1: Upload landscape images as assets
    console.log(`\n📸 Uploading ${adData.landscapeImageUrls.length} landscape image(s)...`);
    const landscapeAssets = await Promise.all(
      adData.landscapeImageUrls.map((url, index) =>
        uploadImageAsset(
          customer,
          url,
          `RDA Marketing Image ${Date.now()}-${index}`,
          'MARKETING_IMAGE'
        )
      )
    );

    // Step 2: Upload square images as assets
    console.log(`\n📸 Uploading ${adData.squareImageUrls.length} square image(s)...`);
    const squareAssets = await Promise.all(
      adData.squareImageUrls.map((url, index) =>
        uploadImageAsset(
          customer,
          url,
          `RDA Square Image ${Date.now()}-${index}`,
          'SQUARE_MARKETING_IMAGE'
        )
      )
    );

    console.log('\n✅ All assets uploaded successfully!');

    // Step 3: Create Responsive Display Ad
    console.log('\n🎨 Creating Responsive Display Ad...');

    const ad = new resources.Ad({
      name: options.adName || `RDA ${Date.now()}`,
      final_urls: [adData.finalUrl || 'https://example.com'],
      type: enums.AdType.RESPONSIVE_DISPLAY_AD,
      responsive_display_ad: {
        marketing_images: landscapeAssets.map((asset) => ({
          asset,
        })),
        square_marketing_images: squareAssets.map((asset) => ({
          asset,
        })),
        headlines: adData.headlines.slice(0, 5).map((text) => ({ text })),
        long_headline: { text: adData.longHeadline },
        descriptions: adData.descriptions.slice(0, 5).map((text) => ({ text })),
        business_name: adData.businessName,
        call_to_action_text: adData.callToAction || 'Learn More',
        // Optional: Add colors if provided
        ...(adData.mainColor && { main_color: adData.mainColor }),
        ...(adData.accentColor && { accent_color: adData.accentColor }),
        allow_flexible_color: adData.allowFlexibleColor !== false,
        format_setting: enums.DisplayAdFormatSetting.NON_NATIVE,
      },
    });

    // Get ad group resource name
    const adGroupResourceName = `customers/${process.env.GOOGLE_ADS_CUSTOMER_ID}/adGroups/${process.env.GOOGLE_ADS_AD_GROUP_ID}`;

    const adGroupAd = new resources.AdGroupAd({
      ad_group: adGroupResourceName,
      ad,
      status: options.status || enums.AdGroupAdStatus.PAUSED, // Start paused for safety
    });

    // Create the ad
    const response = await customer.adGroupAds.create([adGroupAd]);

    console.log('\n🎉 Responsive Display Ad created successfully!');
    console.log(`Resource Name: ${response.results[0].resource_name}`);

    return {
      success: true,
      resourceName: response.results[0].resource_name,
      assets: {
        landscape: landscapeAssets,
        square: squareAssets,
      },
      ad: {
        headlines: adData.headlines,
        longHeadline: adData.longHeadline,
        descriptions: adData.descriptions,
        businessName: adData.businessName,
      },
    };
  } catch (error) {
    console.error('\n❌ Failed to create Responsive Display Ad:', error.message);

    // Extract detailed error info if available
    if (error.errors && error.errors.length > 0) {
      error.errors.forEach((err, i) => {
        console.error(`Error ${i + 1}:`, {
          message: err.message,
          errorCode: err.error_code,
          location: err.location,
        });
      });
    }

    throw new Error(`Failed to create RDA: ${error.message}`);
  }
}

/**
 * List accessible customers (useful for debugging)
 * @returns {Promise<Array<string>>} - Customer resource names
 */
async function listAccessibleCustomers() {
  const { client } = getGoogleAdsClient();

  try {
    const customers = await client.listAccessibleCustomers(
      process.env.GOOGLE_ADS_REFRESH_TOKEN
    );
    return customers;
  } catch (error) {
    console.error('Failed to list customers:', error.message);
    throw error;
  }
}

module.exports = {
  getGoogleAdsClient,
  uploadImageAsset,
  createResponsiveDisplayAd,
  listAccessibleCustomers,
};
