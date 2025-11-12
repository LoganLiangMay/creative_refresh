/**
 * View Ad Details
 * Fetches and displays details of a specific Responsive Display Ad
 */

require('dotenv').config({ path: '../.env.local' });
const { GoogleAdsApi } = require('google-ads-api');

async function viewAd(adResourceName) {
  console.log('\n🔍 Fetching ad details...\n');

  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  });

  const customer = client.Customer({
    customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
  });

  try {
    // Extract ad group ID and ad ID from resource name
    // Format: customers/5533110357/adGroupAds/51907360302~783828561722
    const parts = adResourceName.split('/');
    const adGroupAdId = parts[parts.length - 1];
    const [adGroupId, adId] = adGroupAdId.split('~');

    console.log(`Ad Group ID: ${adGroupId}`);
    console.log(`Ad ID: ${adId}\n`);

    // Query for the ad details
    const query = `
      SELECT
        ad_group_ad.ad.id,
        ad_group_ad.ad.name,
        ad_group_ad.ad.final_urls,
        ad_group_ad.ad.responsive_display_ad.headlines,
        ad_group_ad.ad.responsive_display_ad.long_headline,
        ad_group_ad.ad.responsive_display_ad.descriptions,
        ad_group_ad.ad.responsive_display_ad.business_name,
        ad_group_ad.ad.responsive_display_ad.marketing_images,
        ad_group_ad.ad.responsive_display_ad.square_marketing_images,
        ad_group_ad.ad.responsive_display_ad.call_to_action_text,
        ad_group_ad.status,
        ad_group.id,
        ad_group.name,
        campaign.id,
        campaign.name
      FROM ad_group_ad
      WHERE ad_group.id = ${adGroupId}
        AND ad_group_ad.ad.id = ${adId}
    `;

    const results = await customer.query(query);

    if (!results || results.length === 0) {
      console.log('❌ Ad not found');
      return;
    }

    const row = results[0];
    const ad = row.ad_group_ad.ad;
    const rda = ad.responsive_display_ad;

    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                                                                ║');
    console.log('║     📢 Responsive Display Ad Details                           ║');
    console.log('║                                                                ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log(`🆔 Ad ID: ${ad.id}`);
    console.log(`📛 Ad Name: ${ad.name || 'N/A'}`);
    console.log(`📊 Status: ${row.ad_group_ad.status}\n`);

    console.log(`📍 Campaign: ${row.campaign.name} (ID: ${row.campaign.id})`);
    console.log(`📁 Ad Group: ${row.ad_group.name} (ID: ${row.ad_group.id})\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 Ad Content');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`🏢 Business Name: ${rda.business_name || 'N/A'}\n`);

    console.log(`📰 Long Headline:`);
    console.log(`   "${rda.long_headline?.text || 'N/A'}"\n`);

    console.log(`📋 Headlines (${rda.headlines?.length || 0}):`);
    if (rda.headlines) {
      rda.headlines.forEach((h, i) => {
        console.log(`   ${i + 1}. "${h.text}" (${h.text.length} chars)`);
      });
    }
    console.log('');

    console.log(`📄 Descriptions (${rda.descriptions?.length || 0}):`);
    if (rda.descriptions) {
      rda.descriptions.forEach((d, i) => {
        console.log(`   ${i + 1}. "${d.text}"`);
        console.log(`      (${d.text.length} chars)`);
      });
    }
    console.log('');

    console.log(`🖼️  Marketing Images (Landscape): ${rda.marketing_images?.length || 0}`);
    if (rda.marketing_images) {
      rda.marketing_images.forEach((img, i) => {
        console.log(`   ${i + 1}. Asset: ${img.asset}`);
      });
    }
    console.log('');

    console.log(`🖼️  Square Marketing Images: ${rda.square_marketing_images?.length || 0}`);
    if (rda.square_marketing_images) {
      rda.square_marketing_images.forEach((img, i) => {
        console.log(`   ${i + 1}. Asset: ${img.asset}`);
      });
    }
    console.log('');

    console.log(`🔗 Final URL: ${ad.final_urls?.[0] || 'N/A'}`);
    console.log(`🎯 Call to Action: ${rda.call_to_action_text || 'AUTO'}\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('💡 View in Google Ads UI:');
    console.log(`   https://ads.google.com/aw/ads?campaignId=${row.campaign.id}&adGroupId=${row.ad_group.id}\n`);

    console.log('✅ Ad successfully retrieved!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.errors) {
      error.errors.forEach(err => {
        console.error('   -', err.message);
      });
    }
  }
}

// Get resource name from command line or use the latest one
const adResourceName = process.argv[2] || 'customers/5533110357/adGroupAds/51907360302~783828561722';

console.log(`\n📍 Ad Resource Name: ${adResourceName}\n`);

viewAd(adResourceName);
