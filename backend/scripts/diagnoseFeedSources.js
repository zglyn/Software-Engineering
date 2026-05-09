process.env.NBA_FEED_ARTICLE_THUMBNAILS = '0';

const { diagnoseFeedSources } = require('../services/nba-feed/newsArticles');

diagnoseFeedSources()
  .then((r) => {
    console.log(JSON.stringify(r, null, 2));
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
