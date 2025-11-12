/**
 * Find Recent Ads
 * Lists the most recently created ads to locate our published ad
 */

require('dotenv').config({ path: '../.env.local' });
const { GoogleAdsApi } = require('google-ads-api');

async function findRecentAds() {
  console.log('\n🔍 Searching for recent ads...\n');

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
    // Query for recent responsive display ads
    const query = `
      SELECT
        ad_group_ad.ad.id,
        ad_group_ad.ad.name,
        ad_group_ad.ad.responsive_display_ad.business_name,
        ad_group_ad.status,
        ad_group.id,
        ad_group.name,
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type
      FROM ad_group_ad
      WHERE ad_group_ad.ad.type = 'RESPONSIVE_DISPLAY_AD'
      ORDER BY ad_group_ad.ad.id DESC
      LIMIT 20
    `;

    const results = await customer.query(query);

    if (!results || results.length === 0) {
      console.log('❌ No responsive display ads found\n');
      return;
    }

    console.log(`✅ Found ${results.length} recent responsive display ad(s)\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    results.forEach((row, i) => {
      const ad = row.ad_group_ad.ad;
      const adGroup = row.ad_group;
      const campaign = row.campaign;
      const rda = ad.responsive_display_ad;

      // Highlight our ad
      const isOurAd = ad.id === '783828561722' || rda.business_name === 'Nothin headphones';
      const marker = isOurAd ? ' ⭐ THIS IS YOUR AD!' : '';

      console.log(`${i + 1}. ${ad.name || `Ad ${ad.id}`}${marker}`);
      console.log(`   Ad ID: ${ad.id}`);
      console.log(`   Business: ${rda.business_name || 'N/A'}`);
      console.log(`   Status: ${row.ad_group_ad.status}`);
      console.log('');
      console.log(`   📁 Campaign: ${campaign.name}`);
      console.log(`      ID: ${campaign.id}`);
      console.log(`      Type: ${campaign.advertising_channel_type}`);
      console.log(`      Status: ${campaign.status}`);
      console.log('');
      console.log(`   📂 Ad Group: ${adGroup.name}`);
      console.log(`      ID: ${adGroup.id}`);
      console.log('');

      if (isOurAd) {
        console.log('   🔗 View in Google Ads:');
        console.log(`      https://ads.google.com/aw/ads?campaignId=${campaign.id}&adGroupId=${adGroup.id}`);
        console.log('');
      }

      console.log('   ─────────────────────────────────────────────────────────────────────\n');
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.errors) {
      error.errors.forEach(err => {
        console.error('   -', err.message);
      });
    }
  }
}

findRecentAds();
